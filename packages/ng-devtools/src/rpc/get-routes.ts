import { defineRpcFunction } from 'devframe'
import * as v from 'valibot'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RouteSchema = v.object({
  path: v.string(),
  component: v.optional(v.string()),
  hasChildren: v.boolean(),
  file: v.string(),
})

export const getRoutes = defineRpcFunction({
  name: 'get-routes',
  type: 'query',
  jsonSerializable: true,
  args: [],
  returns: v.array(RouteSchema),
  agent: {
    description:
      'List Angular routes extracted from route configuration files in the workspace. Call before suggesting navigation changes or analyzing the app structure.',
    title: 'List Angular routes',
  },
  setup: (ctx) => ({
    handler: async () => extractRoutes(ctx.cwd),
  }),
})

function extractRoutes(cwd: string) {
  const routes: { path: string; component?: string; hasChildren: boolean; file: string }[] = []
  findRouteFiles(join(cwd, 'src'), cwd, routes)
  return routes
}

function findRouteFiles(
  dir: string,
  cwd: string,
  routes: { path: string; component?: string; hasChildren: boolean; file: string }[],
) {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }

  for (const entry of entries) {
    const full = join(dir, entry)
    try {
      if (statSync(full).isDirectory()) {
        if (entry !== 'node_modules') findRouteFiles(full, cwd, routes)
        continue
      }
    } catch {
      continue
    }

    if (!entry.match(/\.routes\.ts$|routing\.module\.ts$/)) continue

    try {
      const content = readFileSync(full, 'utf-8')
      const relPath = relative(cwd, full)

      for (const match of content.matchAll(/path:\s*['"`]([^'"`]*)['"`]/g)) {
        const after = content.slice(match.index!)
        const componentMatch = after.match(/(?:component|loadComponent).*?(\w+)/)
        const hasChildren = /children\s*:\s*\[/.test(after.slice(0, 200))
        routes.push({
          path: match[1],
          component: componentMatch?.[1],
          hasChildren,
          file: relPath,
        })
      }
    } catch {
      // skip unreadable files
    }
  }
}
