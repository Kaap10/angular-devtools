import { defineRpcFunction } from 'devframe';
import * as v from 'valibot';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SignalEntrySchema = v.object({
  name: v.string(),
  kind: v.string(),
  file: v.string(),
  line: v.number(),
  component: v.optional(v.string()),
});

export const getSignals = defineRpcFunction({
  name: 'get-signals',
  type: 'query',
  jsonSerializable: true,
  args: [],
  returns: v.array(SignalEntrySchema),
  agent: {
    description:
      'Scan source files for signal(), computed(), linkedSignal(), and effect() declarations. Returns name, kind, file, and line number. Call this to understand the reactive architecture before suggesting changes.',
    title: 'List Angular signals from source',
  },
  setup: (ctx) => ({
    handler: async () => scanSignals(join(ctx.cwd, 'src'), ctx.cwd),
  }),
});

interface SignalEntry {
  name: string;
  kind: string;
  file: string;
  line: number;
  component?: string;
}

const SIGNAL_PATTERNS: { pattern: RegExp; kind: string }[] = [
  { pattern: /(\w+)\s*=\s*signal\s*[<(]/g, kind: 'signal' },
  { pattern: /(\w+)\s*=\s*computed\s*\(/g, kind: 'computed' },
  { pattern: /(\w+)\s*=\s*linkedSignal\s*[<(]/g, kind: 'linkedSignal' },
  { pattern: /(\w+)\s*=\s*effect\s*\(/g, kind: 'effect' },
  { pattern: /(\w+)\s*=\s*input\s*[<.(]/g, kind: 'input (signal)' },
  { pattern: /(\w+)\s*=\s*input\.required\s*[<(]/g, kind: 'input.required (signal)' },
  { pattern: /(\w+)\s*=\s*output\s*[<(]/g, kind: 'output (signal)' },
  { pattern: /(\w+)\s*=\s*model\s*[<(]/g, kind: 'model (signal)' },
  { pattern: /(\w+)\s*=\s*viewChild\s*[<.(]/g, kind: 'viewChild (signal)' },
  { pattern: /(\w+)\s*=\s*viewChildren\s*[<(]/g, kind: 'viewChildren (signal)' },
  { pattern: /(\w+)\s*=\s*contentChild\s*[<.(]/g, kind: 'contentChild (signal)' },
  { pattern: /(\w+)\s*=\s*contentChildren\s*[<(]/g, kind: 'contentChildren (signal)' },
  { pattern: /(\w+)\s*=\s*resource\s*[<(]/g, kind: 'resource' },
];

function scanSignals(dir: string, cwd: string): SignalEntry[] {
  const entries: SignalEntry[] = [];
  walk(dir, cwd, entries);
  return entries;
}

function walk(dir: string, cwd: string, out: SignalEntry[]) {
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
      const lines = content.split('\n');

      // Detect enclosing component
      const componentMatch = content.match(/selector:\s*['"`]([^'"`]+)['"`]/);
      const component = componentMatch?.[1];

      for (const { pattern, kind } of SIGNAL_PATTERNS) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
          const lineNum = content.substring(0, match.index).split('\n').length;
          out.push({
            name: match[1],
            kind,
            file: relPath,
            line: lineNum,
            component,
          });
        }
      }
    } catch {
      // skip
    }
  }
}
