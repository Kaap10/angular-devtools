import type { RemoteAssets } from 'devframe'
import { defineDevframe } from 'devframe'
import { getRoutes } from './rpc/get-routes.ts'
import { getComponents } from './rpc/get-components.ts'
import { getBuildMeta } from './rpc/build-meta.ts'
import type {} from './types.ts'

import pkg from '../package.json' with { type: 'json' }

const clientAssets: RemoteAssets = {
  package: '@santoshyadavdev/ng-devtools-assets',
  version: pkg.version,
}

const ngDevtools = defineDevframe({
  id: 'ng-devtools',
  name: 'Angular DevTools',
  version: pkg.version,
  packageName: pkg.name,
  description: 'Inspect Angular component trees, signals, and routes at dev and build time.',
  homepage: 'https://github.com/user/angular-devtools',
  icon: 'ph:angular-logo-duotone',
  importMetaUrl: import.meta.url,
  clientAssets,

  async setup(ctx) {
    const my = ctx.scope('ng-devtools')

    my.rpc.register(getRoutes)
    my.rpc.register(getComponents)
    my.rpc.register(getBuildMeta)

    const componentTree = await my.rpc.sharedState('component-tree', {
      initialValue: {
        nodes: [],
        selectedId: null,
        highlightedId: null,
      },
    })

    await my.rpc.sharedState('routes', {
      initialValue: {
        routes: [],
        activeRoute: null,
      },
    })

    const signalGraphState = await my.rpc.sharedState('signal-graph', {
      initialValue: {
        graph: null as any,
        selectedNodeId: null as string | null,
      },
    })

    const injectorTreeState = await my.rpc.sharedState('injector-tree', {
      initialValue: {
        roots: [] as any[],
        selectedInjectorId: null as string | null,
      },
    })

    my.rpc.register({
      name: 'push-component-tree',
      type: 'action',
      jsonSerializable: true,
      handler: (nodes: unknown[]) => {
        componentTree.mutate((draft) => {
          draft.nodes = nodes as any
        })
      },
    })

    my.rpc.register({
      name: 'select-component',
      type: 'action',
      jsonSerializable: true,
      handler: (id: string | null) => {
        componentTree.mutate((draft) => {
          draft.selectedId = id
        })
      },
    })

    my.rpc.register({
      name: 'push-signal-graph',
      type: 'action',
      jsonSerializable: true,
      handler: (graph: unknown) => {
        signalGraphState.mutate((draft) => {
          draft.graph = graph as any
        })
      },
    })

    my.rpc.register({
      name: 'push-injector-tree',
      type: 'action',
      jsonSerializable: true,
      handler: (roots: unknown[]) => {
        injectorTreeState.mutate((draft) => {
          draft.roots = roots as any
        })
      },
    })

    // Agent resources
    ctx.agent.registerResource({
      id: 'ng-devtools:component-tree',
      name: 'Angular Component Tree',
      description: 'Live component hierarchy snapshot as JSON.',
      mimeType: 'application/json',
      read: () => ({ text: JSON.stringify(componentTree.value(), null, 2) }),
    })

    ctx.agent.registerResource({
      id: 'ng-devtools:signal-graph',
      name: 'Angular Signal Graph',
      description: 'Live signal dependency graph: nodes (signal, computed, effect, linkedSignal) and edges (producer→consumer). Read this to understand reactive data flow.',
      mimeType: 'application/json',
      read: () => ({ text: JSON.stringify(signalGraphState.value(), null, 2) }),
    })

    ctx.agent.registerResource({
      id: 'ng-devtools:injector-tree',
      name: 'Angular Injector Tree',
      description: 'Live DI injector hierarchy with providers at each level.',
      mimeType: 'application/json',
      read: () => ({ text: JSON.stringify(injectorTreeState.value(), null, 2) }),
    })

    // Agent tools
    ctx.agent.registerTool({
      id: 'ng-devtools:highlight',
      description: 'Highlight a component in the running Angular app by its selector.',
      safety: 'action',
      handler: async (args: { selector: string }) => {
        await ctx.rpc.invokeLocal('ng-devtools:select-component', args.selector)
        void my.rpc.broadcast({ method: 'highlight-in-page', args: [args.selector], optional: true })
        return { markdown: `Highlighted \`${args.selector}\` in the page overlay.` }
      },
    })

    ctx.agent.registerTool({
      id: 'ng-devtools:inspect-signals',
      description: 'Get the signal graph for a specific component by CSS selector. Returns signal nodes (signal, computed, linkedSignal, effect) and their dependency edges. Call this to understand reactive data flow before suggesting state changes.',
      safety: 'read',
      handler: async (args: { selector: string }) => {
        try {
          const result = await my.rpc.broadcast({ method: 'get-signal-graph-for', args: [args.selector] })
          return { markdown: JSON.stringify(result, null, 2) }
        } catch {
          const cached = signalGraphState.value().graph
          return { markdown: cached ? JSON.stringify(cached, null, 2) : 'No signal graph available. Is the Angular app running with debug mode?' }
        }
      },
    })

    ctx.agent.registerTool({
      id: 'ng-devtools:inspect-providers',
      description: 'Get DI providers and the injector resolution path for a component by CSS selector. Call this to understand dependency injection before suggesting provider changes.',
      safety: 'read',
      handler: async (args: { selector: string }) => {
        try {
          const result = await my.rpc.broadcast({ method: 'get-providers-for', args: [args.selector] })
          return { markdown: JSON.stringify(result, null, 2) }
        } catch {
          const cached = injectorTreeState.value().roots
          return { markdown: cached.length ? JSON.stringify(cached, null, 2) : 'No injector data available.' }
        }
      },
    })
  },
})

export default ngDevtools
