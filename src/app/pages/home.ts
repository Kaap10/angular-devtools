import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-home',
  template: `
    <section>
      <h1>Welcome to Angular DevTools Demo</h1>
      <p>Counter: {{ counter() }}</p>
      <button (click)="increment()">Increment</button>
    </section>
  `,
  styles: `
    section { padding: 24px; }
    h1 { font-size: 24px; margin-bottom: 12px; }
    button { padding: 8px 16px; cursor: pointer; }
  `,
})
export class Home {
  counter = signal(0);

  increment() {
    this.counter.update((c) => c + 1);
  }
}
