import { Component, input, signal, effect } from '@angular/core'
import { JsonPipe } from '@angular/common'
import type { DevframeRpcClient } from 'devframe/client'

interface ComponentInfo {
  selector: string
  file: string
  inputs: string[]
  outputs: string[]
  isStandalone: boolean
}

@Component({
  selector: 'app-component-tree',
  imports: [JsonPipe],
  template: `
    <div class="toolbar">
      <input
        type="text"
        placeholder="Filter components…"
        [value]="filter()"
        (input)="filter.set($any($event.target).value)"
      />
      <button (click)="refresh()">Refresh</button>
    </div>

    @if (loading()) {
      <p class="muted">Scanning components…</p>
    } @else if (filtered().length === 0) {
      <p class="muted">No components found.</p>
    } @else {
      <ul class="component-list" role="list">
        @for (comp of filtered(); track comp.selector) {
          <li class="component-item" (click)="select(comp)">
            <div class="selector">&lt;{{ comp.selector }}&gt;</div>
            <div class="file">{{ comp.file }}</div>
            @if (comp.inputs.length) {
              <div class="io">
                <span class="label">Inputs:</span>
                {{ comp.inputs.join(', ') }}
              </div>
            }
            @if (comp.outputs.length) {
              <div class="io">
                <span class="label">Outputs:</span>
                {{ comp.outputs.join(', ') }}
              </div>
            }
          </li>
        }
      </ul>
    }

    @if (selected()) {
      <aside class="detail">
        <h3>&lt;{{ selected()!.selector }}&gt;</h3>
        <pre>{{ selected() | json }}</pre>
      </aside>
    }
  `,
  styles: `
    .toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
    input {
      flex: 1; padding: 8px 12px; background: #18181b; border: 1px solid #27272a;
      border-radius: 6px; color: #e4e4e7; font-size: 14px; outline: none;
    }
    input:focus { border-color: #a78bfa; }
    button {
      padding: 8px 16px; background: #3f3f46; border: none; border-radius: 6px;
      color: #e4e4e7; cursor: pointer; font-size: 13px;
    }
    button:hover { background: #52525b; }
    .muted { color: #71717a; font-size: 14px; }
    .component-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .component-item {
      background: #18181b; border: 1px solid #27272a; border-radius: 8px;
      padding: 12px 16px; cursor: pointer; transition: border-color 0.15s;
    }
    .component-item:hover { border-color: #a78bfa; }
    .selector { font-family: monospace; font-size: 15px; color: #a78bfa; font-weight: 600; }
    .file { font-size: 12px; color: #71717a; margin-top: 2px; }
    .io { font-size: 13px; color: #a1a1aa; margin-top: 4px; }
    .io .label { color: #71717a; }
    .detail {
      margin-top: 16px; padding: 16px; background: #18181b;
      border: 1px solid #27272a; border-radius: 8px;
    }
    .detail h3 { font-family: monospace; color: #a78bfa; margin-bottom: 8px; }
    pre { font-size: 12px; color: #a1a1aa; white-space: pre-wrap; }
  `,
})
export class ComponentTree {
  rpc = input<DevframeRpcClient | null>(null)

  components = signal<ComponentInfo[]>([])
  filter = signal('')
  loading = signal(false)
  selected = signal<ComponentInfo | null>(null)

  filtered = signal<ComponentInfo[]>([])

  constructor() {
    effect(() => {
      const q = this.filter().toLowerCase()
      const all = this.components()
      this.filtered.set(
        q ? all.filter((c) => c.selector.includes(q) || c.file.includes(q)) : all,
      )
    })

    effect(() => {
      const client = this.rpc()
      if (client) this.refresh()
    })
  }

  async refresh() {
    const client = this.rpc()
    if (!client) return
    this.loading.set(true)
    try {
      const my = client.scope('ng-devtools')
      const result = (await my.rpc.call('get-components')) as ComponentInfo[]
      this.components.set(result)
    } finally {
      this.loading.set(false)
    }
  }

  select(comp: ComponentInfo) {
    this.selected.set(comp)
    const client = this.rpc()
    if (client) {
      client.scope('ng-devtools').rpc.callEvent('select-component', comp.selector)
    }
  }
}
