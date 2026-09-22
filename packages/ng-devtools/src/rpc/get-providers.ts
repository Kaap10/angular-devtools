import { defineRpcFunction } from 'devframe';
import * as v from 'valibot';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ProviderEntrySchema = v.object({
  token: v.string(),
  source: v.string(),
  file: v.string(),
  line: v.number(),
  providedIn: v.optional(v.string()),
  type: v.string(),
});

export const getProviders = defineRpcFunction({
  name: 'get-providers',
  type: 'query',
  jsonSerializable: true,
  args: [],
  returns: v.array(ProviderEntrySchema),
  agent: {
    description:
      'Scan source files for DI providers: @Injectable services, inject() calls, and providers arrays. Returns token, file, and where it is provided. Call this to understand the DI architecture.',
    title: 'List Angular DI providers from source',
  },
  setup: (ctx) => ({
    handler: async () => scanProviders(join(ctx.cwd, 'src'), ctx.cwd),
  }),
});

const DECORATOR_KEYWORDS = new Set([
  'Component',
  'NgModule',
  'Injectable',
  'Directive',
  'Pipe',
  'Service',
  'Input',
  'Output',
  'Inject',
  'Optional',
  'Self',
  'SkipSelf',
  'Host',
]);

// Maps provide*() helper functions to the tokens they register
const PROVIDE_FN_TO_TOKEN: Record<string, string> = {
  provideHttpClient: 'HttpClient',
  provideRouter: 'Router',
  provideAnimations: 'AnimationDriver',
  provideAnimationsAsync: 'AnimationDriver',
  provideClientHydration: 'ClientHydration',
  provideZoneChangeDetection: 'NgZone',
  provideExperimentalZonelessChangeDetection: 'ChangeDetection (zoneless)',
  provideBrowserGlobalErrorListeners: 'ErrorHandler',
  provideServiceWorker: 'ServiceWorker',
  provideExperimentalCheckNoChanges: 'CheckNoChanges',
  providePlatformInitializer: 'PlatformInitializer',
  provideAppInitializer: 'AppInitializer',
  provideEnvironmentInitializer: 'EnvironmentInitializer',
};

interface ProviderEntry {
  token: string;
  source: string;
  file: string;
  line: number;
  providedIn?: string;
  type: string;
}

function scanProviders(dir: string, cwd: string): ProviderEntry[] {
  const entries: ProviderEntry[] = [];
  walk(dir, cwd, entries);
  return entries;
}

function walk(dir: string, cwd: string, out: ProviderEntry[]) {
  let items: string[];
  try {
    items = readdirSync(dir);
  } catch {
    return;
  }

  for (const item of items) {
    const full = join(dir, item);
    try {
      if (statSync(full).isDirectory()) {
        if (item !== 'node_modules') walk(full, cwd, out);
        continue;
      }
    } catch {
      continue;
    }

    if (!item.endsWith('.ts') || item.endsWith('.spec.ts') || item.endsWith('.d.ts')) continue;

    try {
      const content = readFileSync(full, 'utf-8');
      const relPath = relative(cwd, full);

      // @Injectable({ providedIn: 'root' }) or @Service (with or without parens)
      for (const match of content.matchAll(
        /@(?:Injectable|Service)\s*(?:\(\s*\{?\s*(?:providedIn:\s*['"`](\w+)['"`])?\s*\}?\s*\))?\s*\n?\s*(?:export\s+)?class\s+(\w+)/g,
      )) {
        const decorator = content.substring(match.index!, match.index! + 10);
        const isService = decorator.includes('Service');
        out.push({
          token: match[2],
          source: 'class',
          file: relPath,
          line: content.substring(0, match.index!).split('\n').length,
          // @Service defaults to providedIn: 'root'
          providedIn: match[1] || (isService ? 'root' : undefined),
          type: 'injectable',
        });
      }

      // inject(Token) calls — covers `x = inject(T)`, `readonly x = inject(T)`, `private x = inject<T>()`
      for (const match of content.matchAll(
        /(?:(?:private|protected|public|readonly)\s+)*(\w+)\s*=\s*inject\s*(?:<[^>]*>)?\s*\(\s*(\w+)/g,
      )) {
        out.push({
          token: match[2],
          source: match[1],
          file: relPath,
          line: content.substring(0, match.index!).split('\n').length,
          type: 'injection',
        });
      }

      // Constructor injection — @Inject(Token) or typed parameter
      for (const match of content.matchAll(
        /@Inject\(\s*(\w+)\s*\)\s*(?:private|protected|public|readonly|\s)*(\w+)/g,
      )) {
        out.push({
          token: match[1],
          source: match[2],
          file: relPath,
          line: content.substring(0, match.index!).split('\n').length,
          type: 'injection',
        });
      }

      // provide*() calls in app config — provideHttpClient(), provideRouter(), etc.
      for (const match of content.matchAll(/\b(provide\w+)\s*\(/g)) {
        const fnName = match[1];
        const token = PROVIDE_FN_TO_TOKEN[fnName];
        if (token) {
          out.push({
            token,
            source: fnName + '()',
            file: relPath,
            line: content.substring(0, match.index!).split('\n').length,
            providedIn: 'root',
            type: 'root-provider',
          });
        }
      }

      // providers: [...] in @Component / @NgModule
      const providersMatch = content.match(/providers:\s*\[([\s\S]*?)\]/);
      if (providersMatch) {
        const block = providersMatch[1];
        const lineOffset = content.substring(0, providersMatch.index!).split('\n').length;

        for (const tokenMatch of block.matchAll(/\b([A-Z]\w+)\b/g)) {
          const token = tokenMatch[1];
          if (DECORATOR_KEYWORDS.has(token)) continue;
          out.push({
            token,
            source: 'providers array',
            file: relPath,
            line: lineOffset,
            type: 'provider',
          });
        }
      }
    } catch {
      // skip
    }
  }
}
