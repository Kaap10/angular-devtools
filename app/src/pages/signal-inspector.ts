import { Component, input, signal, effect, computed } from '@angular/core'
import { JsonPipe } from '@angular/common'
import type { DevframeRpcClient } from 'devframe/client'

interface SignalNode {
  id: string
  kind: string
  label?: string
  epoch: number
  value?: unknown
  watched: boolean
}

interface SignalEdge {
  consumer: number
  producer: number
}

interface SignalGraph {
  nodes: SignalNode[]
  edges: SignalEdge[]
  componentSelector?: string
}

const KIND_COLORS: Record<string, string> = {
  signal: '#a78bfa',
  computed: '#60a5fa',
  linkedSignal: '#34d399',
  effect: '#fb923c',
  template: '#94a3b8',
  afterRenderEffectPhase: '#f472b6',
  childSignalProp: '#c084fc',
  unknown: '#71717a',
}

@Component({
  selector: 'app-signal-inspector',
  imports: [JsonPipe],
  template: `
    <div class="toolbar">
      <input
        type="text"
        placeholder="Filter by name or kind…"
        [value]="filter()"
        (input)="filter.set($any($event.target).value)"
      />
      <span class="label">Component: {{ graph()?.componentSelector ?? '—' }}</span>
    </div>

    @if (!graph()) {
      <div class="empty">
        <p class="muted">No signal graph available.</p>
        <p class="hint">Signal inspection requires Angular 19+ with debug mode. The overlay collects the graph from the running app.</p>
      </div>
    } @else {
      <div class="legend">
        @for (entry of kindLegend; track entry.kind) {
          <span class="legend-item">
            <span class="dot" [style.background]="entry.color"></span>
            {{ entry.kind }}
          </span>
        }
      </div>

      <div class="nodes">
        @for (node of filteredNodes(); track node.id) {
          <div
            class="node-card"
            [class.selected]="selectedNode()?.id === node.id"
            (click)="selectNode(node)"
          >
            <div class="node-header">
              <span class="kind-badge" [style.background]="kindColor(node.kind)">{{ node.kind }}</span>
              <span class="node-label">{{ node.label ?? '(unnamed)' }}</span>
              @if (node.watched) {
                <span class="watched-badge">watching</span>
              }
            </div>
            @if (node.value !== undefined) {
              <div class="node-value">{{ node.value | json }}</div>
            }
            <div class="node-meta">
              Epoch: {{ node.epoch }}
              @if (getDependencies(node).length) {
                · Deps: {{ getDependencies(node).length }}
              }
              @if (getConsumers(node).length) {
                · Consumers: {{ getConsumers(node).length }}
              }
            </div>
          </div>
        }
      </div>

      @if (selectedNode()) {
        <aside class="detail-panel">
          <h3>{{ selectedNode()!.label ?? selectedNode()!.id }}</h3>
          <dl>
            <dt>Kind</dt><dd>{{ selectedNode()!.kind }}</dd>
            <dt>Epoch</dt><dd>{{ selectedNode()!.epoch }}</dd>
            @if (selectedNode()!.value !== undefined) {
              <dt>Value</dt><dd><pre>{{ selectedNode()!.value | json }}</pre></dd>
            }
          </dl>
          @if (getDependencies(selectedNode()!).length) {
            <h4>Dependencies (producers)</h4>
            <ul>
              @for (dep of getDependencies(selectedNode()!); track dep.id) {
                <li><span class="kind-badge sm" [style.background]="kindColor(dep.kind)">{{ dep.kind }}</span> {{ dep.label ?? dep.id }}</li>
              }
            </ul>
          }
          @if (getConsumers(selectedNode()!).length) {
            <h4>Consumers</h4>
            <ul>
              @for (con of getConsumers(selectedNode()!); track con.id) {
                <li><span class="kind-badge sm" [style.background]="kindColor(con.kind)">{{ con.kind }}</span> {{ con.label ?? con.id }}</li>
              }
            </ul>
          }
        </aside>
      }
    }
  `,
  styles: `
    .toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
    input {
      flex: 1; padding: 8px 12px; background: #18181b; border: 1px solid #27272a;
      border-radius: 6px; color: #e4e4e7; font-size: 14px; outline: none;
    }
    input:focus { border-color: #a78bfa; }
    .label { font-size: 13px; color: #71717a; white-space: nowrap; }
    .empty { text-align: center; padding: 48px 16px; }
    .muted { color: #71717a; font-size: 14px; }
    .hint { color: #52525b; font-size: 12px; margin-top: 8px; }
    .legend { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .legend-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #a1a1aa; }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .nodes { display: flex; flex-direction: column; gap: 8px; }
    .node-card {
      background: #18181b; border: 1px solid #27272a; border-radius: 8px;
      padding: 12px 16px; cursor: pointer; transition: border-color 0.15s;
    }
    .node-card:hover { border-color: #3f3f46; }
    .node-card.selected { border-color: #a78bfa; }
    .node-header { display: flex; align-items: center; gap: 8px; }
    .kind-badge {
      font-size: 11px; padding: 2px 8px; border-radius: 4px; color: #fff;
      font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
    }
    .kind-badge.sm { font-size: 10px; padding: 1px 5px; }
    .node-label { font-family: monospace; font-size: 14px; color: #e4e4e7; }
    .watched-badge { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: #14532d; color: #4ade80; }
    .node-value { font-family: monospace; font-size: 12px; color: #a1a1aa; margin-top: 4px; max-height: 40px; overflow: hidden; }
    .node-meta { font-size: 11px; color: #52525b; margin-top: 4px; }
    .detail-panel {
      margin-top: 16px; padding: 16px; background: #18181b;
      border: 1px solid #27272a; border-radius: 8px;
    }
    .detail-panel h3 { font-family: monospace; color: #a78bfa; margin-bottom: 12px; }
    .detail-panel h4 { font-size: 12px; color: #71717a; margin: 12px 0 4px; text-transform: uppercase; letter-spacing: 0.05em; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 13px; }
    dt { color: #71717a; }
    dd { color: #e4e4e7; }
    pre { font-size: 12px; white-space: pre-wrap; margin: 0; }
    ul { list-style: none; padding: 0; font-size: 13px; }
    li { padding: 2px 0; color: #a1a1aa; display: flex; align-items: center; gap: 6px; }
  `,
})
export class SignalInspector {
  rpc = input<DevframeRpcClient | null>(null)

  graph = signal<SignalGraph | null>(null)
  filter = signal('')
  selectedNode = signal<SignalNode | null>(null)

  readonly kindLegend = Object.entries(KIND_COLORS).map(([kind, color]) => ({ kind, color }))

  filteredNodes = computed(() => {
    const g = this.graph()
    if (!g) return []
    const q = this.filter().toLowerCase()
    return q
      ? g.nodes.filter((n) => (n.label ?? '').toLowerCase().includes(q) || n.kind.includes(q))
      : g.nodes
  })

  constructor() {
    effect(() => {
      const client = this.rpc()
      if (!client) return
      this.loadSignalGraph(client)
    })
  }

  async loadSignalGraph(client: DevframeRpcClient) {
    const my = client.scope('ng-devtools')
    const state = await my.rpc.sharedState('signal-graph')
    const val = state.value() as any
    if (val?.graph) this.graph.set(val.graph)
    state.on('updated', (next: any) => {
      if (next?.graph) this.graph.set(next.graph)
    })
  }

  selectNode(node: SignalNode) {
    this.selectedNode.set(this.selectedNode()?.id === node.id ? null : node)
  }

  kindColor(kind: string) {
    return KIND_COLORS[kind] ?? KIND_COLORS['unknown']
  }

  getDependencies(node: SignalNode): SignalNode[] {
    const g = this.graph()
    if (!g) return []
    const idx = g.nodes.findIndex((n) => n.id === node.id)
    return g.edges
      .filter((e) => e.consumer === idx)
      .map((e) => g.nodes[e.producer])
      .filter(Boolean)
  }

  getConsumers(node: SignalNode): SignalNode[] {
    const g = this.graph()
    if (!g) return []
    const idx = g.nodes.findIndex((n) => n.id === node.id)
    return g.edges
      .filter((e) => e.producer === idx)
      .map((e) => g.nodes[e.consumer])
      .filter(Boolean)
  }
}
