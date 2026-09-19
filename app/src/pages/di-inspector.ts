import { Component, input, signal, effect, computed } from '@angular/core'
import type { DevframeRpcClient } from 'devframe/client'

interface ProviderInfo {
  token: string
  type: string
  isViewProvider: boolean
}

interface InjectorNode {
  injector: { id: string; type: string; name: string; providerCount: number }
  providers: ProviderInfo[]
  children: InjectorNode[]
}

const TYPE_COLORS: Record<string, string> = {
  element: '#60a5fa',
  environment: '#34d399',
  null: '#71717a',
}

@Component({
  selector: 'app-di-inspector',
  template: `
    <div class="toolbar">
      <input
        type="text"
        placeholder="Filter by injector name or token…"
        [value]="filter()"
        (input)="filter.set($any($event.target).value)"
      />
      <label class="checkbox">
        <input type="checkbox" [checked]="hideEmpty()" (change)="hideEmpty.set(!hideEmpty())" />
        Hide empty injectors
      </label>
    </div>

    @if (roots().length === 0) {
      <div class="empty">
        <p class="muted">No injector tree available.</p>
        <p class="hint">DI inspection requires Angular 17+ with debug mode. The overlay collects injector data from the running app.</p>
      </div>
    } @else {
      <div class="tree-container">
        @for (root of filteredRoots(); track root.injector.id) {
          <ng-container *ngTemplateOutlet="undefined" />
          @defer {
            <div class="injector-tree">
              @for (item of flattenTree(root); track item.node.injector.id) {
                <div
                  class="injector-row"
                  [class.selected]="selectedId() === item.node.injector.id"
                  [style.paddingLeft.px]="item.depth * 24 + 12"
                  (click)="select(item.node)"
                >
                  <span class="type-badge" [style.background]="typeColor(item.node.injector.type)">
                    {{ item.node.injector.type }}
                  </span>
                  <span class="name">{{ item.node.injector.name }}</span>
                  @if (item.node.injector.providerCount > 0) {
                    <span class="provider-count">{{ item.node.injector.providerCount }} providers</span>
                  }
                </div>
              }
            </div>
          }
        }
      </div>

      @if (selectedInjector()) {
        <aside class="detail-panel">
          <div class="detail-header">
            <span class="type-badge" [style.background]="typeColor(selectedInjector()!.injector.type)">
              {{ selectedInjector()!.injector.type }}
            </span>
            <h3>{{ selectedInjector()!.injector.name }}</h3>
          </div>

          @if (selectedInjector()!.providers.length === 0) {
            <p class="muted">No providers configured on this injector.</p>
          } @else {
            <table role="table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Type</th>
                  <th>View</th>
                </tr>
              </thead>
              <tbody>
                @for (p of selectedInjector()!.providers; track p.token) {
                  <tr>
                    <td class="token">{{ p.token }}</td>
                    <td>{{ p.type }}</td>
                    <td>{{ p.isViewProvider ? 'Yes' : '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </aside>
      }
    }
  `,
  styles: `
    .toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
    input[type=text] {
      flex: 1; padding: 8px 12px; background: #18181b; border: 1px solid #27272a;
      border-radius: 6px; color: #e4e4e7; font-size: 14px; outline: none;
    }
    input[type=text]:focus { border-color: #a78bfa; }
    .checkbox { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #a1a1aa; white-space: nowrap; cursor: pointer; }
    .empty { text-align: center; padding: 48px 16px; }
    .muted { color: #71717a; font-size: 14px; }
    .hint { color: #52525b; font-size: 12px; margin-top: 8px; }
    .tree-container { display: flex; flex-direction: column; }
    .injector-row {
      display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      cursor: pointer; border-bottom: 1px solid #1e1e22; transition: background 0.1s;
    }
    .injector-row:hover { background: #18181b; }
    .injector-row.selected { background: #1e1b4b; border-color: #a78bfa; }
    .type-badge {
      font-size: 10px; padding: 2px 6px; border-radius: 4px; color: #fff;
      font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
    }
    .name { font-family: monospace; font-size: 13px; color: #e4e4e7; }
    .provider-count { font-size: 11px; color: #71717a; margin-left: auto; }
    .detail-panel {
      margin-top: 16px; padding: 16px; background: #18181b;
      border: 1px solid #27272a; border-radius: 8px;
    }
    .detail-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .detail-header h3 { font-family: monospace; color: #e4e4e7; margin: 0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
      text-align: left; padding: 6px 10px; background: #0f0f11;
      color: #71717a; font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.05em; border-bottom: 1px solid #27272a;
    }
    td { padding: 8px 10px; border-bottom: 1px solid #1e1e22; }
    .token { font-family: monospace; color: #a78bfa; }
  `,
})
export class DiInspector {
  rpc = input<DevframeRpcClient | null>(null)

  roots = signal<InjectorNode[]>([])
  filter = signal('')
  hideEmpty = signal(false)
  selectedId = signal<string | null>(null)

  selectedInjector = computed(() => {
    const id = this.selectedId()
    if (!id) return null
    return this.findNode(this.roots(), id)
  })

  filteredRoots = computed(() => {
    let roots = this.roots()
    if (this.hideEmpty()) {
      roots = this.filterEmpty(roots)
    }
    const q = this.filter().toLowerCase()
    if (q) {
      roots = this.filterByQuery(roots, q)
    }
    return roots
  })

  constructor() {
    effect(() => {
      const client = this.rpc()
      if (client) this.loadInjectorTree(client)
    })
  }

  async loadInjectorTree(client: DevframeRpcClient) {
    const my = client.scope('ng-devtools')
    const state = await my.rpc.sharedState('injector-tree')
    const val = state.value() as any
    if (val?.roots?.length) this.roots.set(val.roots)
    state.on('updated', (next: any) => {
      if (next?.roots) this.roots.set(next.roots)
    })
  }

  select(node: InjectorNode) {
    this.selectedId.set(
      this.selectedId() === node.injector.id ? null : node.injector.id,
    )
  }

  typeColor(type: string) {
    return TYPE_COLORS[type] ?? TYPE_COLORS['null']
  }

  flattenTree(root: InjectorNode): { node: InjectorNode; depth: number }[] {
    const result: { node: InjectorNode; depth: number }[] = []
    const walk = (node: InjectorNode, depth: number) => {
      result.push({ node, depth })
      for (const child of node.children) {
        walk(child, depth + 1)
      }
    }
    walk(root, 0)
    return result
  }

  private findNode(nodes: InjectorNode[], id: string): InjectorNode | null {
    for (const n of nodes) {
      if (n.injector.id === id) return n
      const found = this.findNode(n.children, id)
      if (found) return found
    }
    return null
  }

  private filterEmpty(nodes: InjectorNode[]): InjectorNode[] {
    return nodes
      .map((n) => ({
        ...n,
        children: this.filterEmpty(n.children),
      }))
      .filter((n) => n.injector.providerCount > 0 || n.children.length > 0)
  }

  private filterByQuery(nodes: InjectorNode[], q: string): InjectorNode[] {
    return nodes
      .map((n) => ({
        ...n,
        children: this.filterByQuery(n.children, q),
      }))
      .filter(
        (n) =>
          n.injector.name.toLowerCase().includes(q) ||
          n.providers.some((p) => p.token.toLowerCase().includes(q)) ||
          n.children.length > 0,
      )
  }
}
