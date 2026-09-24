import { defineRpcFunction } from 'devframe';
import * as v from 'valibot';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ComponentSchema = v.object({
  selector: v.string(),
  file: v.string(),
  inputs: v.array(v.string()),
  outputs: v.array(v.string()),
  isStandalone: v.boolean(),
});

export const getComponents = defineRpcFunction({
  name: 'get-components',
  type: 'query',
  jsonSerializable: true,
  args: [],
  returns: v.array(ComponentSchema),
  agent: {
    description:
      'Discover Angular components by scanning source files for @Component decorators. Returns selectors, inputs, outputs, and file paths. Call this to understand the component architecture.',
    title: 'List Angular components',
  },
  setup: (ctx) => ({
    handler: async () => scanComponents(join(ctx.cwd, 'src'), ctx.cwd),
  }),
});

interface ComponentInfo {
  selector: string;
  file: string;
  inputs: string[];
  outputs: string[];
  isStandalone: boolean;
}

function scanComponents(dir: string, cwd: string): ComponentInfo[] {
  const components: ComponentInfo[] = [];
  walk(dir, cwd, components);
  return components;
}

function walk(dir: string, cwd: string, out: ComponentInfo[]) {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = join(dir, entry);
    try {
      if (statSync(full).isDirectory()) {
        if (entry !== 'node_modules') walk(full, cwd, out);
        continue;
      }
    } catch {
      continue;
    }

    if (!entry.endsWith('.ts') || entry.endsWith('.spec.ts')) continue;

    try {
      const content = readFileSync(full, 'utf-8');
      if (!content.includes('@Component')) continue;

      const selectorMatch = content.match(/selector:\s*['"`]([^'"`]+)['"`]/);
      if (!selectorMatch) continue;

      const inputs: string[] = [];
      for (const m of content.matchAll(/(\w+)\s*=\s*input(?:<|\.required)/g)) {
        inputs.push(m[1]);
      }
      for (const m of content.matchAll(/@Input\(\)\s+(\w+)/g)) {
        inputs.push(m[1]);
      }

      const outputs: string[] = [];
      for (const m of content.matchAll(/(\w+)\s*=\s*output(?:<|\()/g)) {
        outputs.push(m[1]);
      }
      for (const m of content.matchAll(/@Output\(\)\s+(\w+)/g)) {
        outputs.push(m[1]);
      }

      const isStandalone = !content.includes('standalone: false');

      out.push({
        selector: selectorMatch[1],
        file: relative(cwd, full),
        inputs,
        outputs,
        isStandalone,
      });
    } catch {
      // skip
    }
  }
}
