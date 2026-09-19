import { Component, input, signal, effect } from '@angular/core'
import { JsonPipe } from '@angular/common'
import type { DevframeRpcClient } from 'devframe/client'

@Component({
  selector: 'app-dashboard',
  imports: [JsonPipe],
  template: `
    <div class="grid">
      <div class="card">
        <h3>Project</h3>
        <dl>
          <dt>Name</dt><dd>{{ meta()?.projectName ?? '…' }}</dd>
          <dt>Angular</dt><dd>{{ meta()?.angularVersion ?? '…' }}</dd>
          <dt>TypeScript</dt><dd>{{ meta()?.typescript ?? '…' }}</dd>
          <dt>SSR</dt><dd>{{ meta()?.ssr ? 'Yes' : 'No' }}</dd>
        </dl>
      </div>
      <div class="card">
        <h3>Components</h3>
        <p class="big">{{ componentCount() }}</p>
        <p class="sub">discovered in source</p>
      </div>
      <div class="card">
        <h3>Routes</h3>
        <p class="big">{{ routeCount() }}</p>
        <p class="sub">registered paths</p>
      </div>
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
    .card {
      background: #18181b; border: 1px solid #27272a; border-radius: 10px; padding: 20px;
    }
    h3 { font-size: 13px; text-transform: uppercase; color: #71717a; margin-bottom: 12px; letter-spacing: 0.05em; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 14px; }
    dt { color: #a1a1aa; }
    dd { color: #e4e4e7; font-weight: 500; }
    .big { font-size: 36px; font-weight: 700; color: #a78bfa; }
    .sub { font-size: 13px; color: #71717a; margin-top: 4px; }
  `,
})
export class Dashboard {
  rpc = input<DevframeRpcClient | null>(null)

  meta = signal<any>(null)
  componentCount = signal(0)
  routeCount = signal(0)

  constructor() {
    effect(() => {
      const client = this.rpc()
      if (!client) return

      const my = client.scope('ng-devtools')
      my.rpc.call('build-meta').then((m: any) => this.meta.set(m))
      my.rpc.call('get-components').then((c: any[]) => this.componentCount.set(c.length))
      my.rpc.call('get-routes').then((r: any[]) => this.routeCount.set(r.length))
    })
  }
}
