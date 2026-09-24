// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  AngularDebugApi,
  ComponentTreeNode,
  collectComponentTree,
  walkAngularTree,
} from '../overlay.ts';

describe('overlay component tree traversal', () => {
  it('traverses direct component children', () => {
    document.body.innerHTML = `
      <app-root ng-version="19.0.0">
        <app-header></app-header>
        <app-footer></app-footer>
      </app-root>
    `;

    const componentsMap = new Map<Element, unknown>();
    const rootEl = document.querySelector('app-root')!;
    const headerEl = document.querySelector('app-header')!;
    const footerEl = document.querySelector('app-footer')!;

    componentsMap.set(rootEl, { name: 'Root' });
    componentsMap.set(headerEl, { name: 'Header' });
    componentsMap.set(footerEl, { name: 'Footer' });

    const mockNg: AngularDebugApi = {
      getComponent: (el: Element) => componentsMap.get(el) ?? null,
    };

    const nodes: ComponentTreeNode[] = [];
    walkAngularTree(rootEl, nodes, mockNg);

    expect(nodes.length).toBe(1);
    expect(nodes[0].selector).toBe('app-root');
    expect(nodes[0].children.map((c) => c.selector)).toEqual(['app-header', 'app-footer']);
  });

  it('traverses through non-component HTML wrapper elements (fix for #11)', () => {
    document.body.innerHTML = `
      <app-root ng-version="19.0.0">
        <div class="layout-wrapper">
          <header>
            <app-navbar></app-navbar>
          </header>
          <main class="content-area">
            <section>
              <app-product-list></app-product-list>
            </section>
          </main>
          <footer id="main-footer">
            <app-footer></app-footer>
          </footer>
        </div>
      </app-root>
    `;

    const componentsMap = new Map<Element, unknown>();
    const rootEl = document.querySelector('app-root')!;
    const navEl = document.querySelector('app-navbar')!;
    const prodEl = document.querySelector('app-product-list')!;
    const footEl = document.querySelector('app-footer')!;

    componentsMap.set(rootEl, { name: 'Root' });
    componentsMap.set(navEl, { name: 'Navbar' });
    componentsMap.set(prodEl, { name: 'ProductList' });
    componentsMap.set(footEl, { name: 'Footer' });

    const mockNg: AngularDebugApi = {
      getComponent: (el: Element) => componentsMap.get(el) ?? null,
    };

    const nodes: ComponentTreeNode[] = [];
    walkAngularTree(rootEl, nodes, mockNg);

    expect(nodes.length).toBe(1);
    expect(nodes[0].selector).toBe('app-root');
    expect(nodes[0].children.map((c) => c.selector)).toEqual([
      'app-navbar',
      'app-product-list',
      'app-footer',
    ]);
  });

  it('handles multi-level nested components separated by HTML tags', () => {
    document.body.innerHTML = `
      <app-root ng-version="19.0.0">
        <div class="card">
          <app-card>
            <div class="card-body">
              <app-card-item></app-card-item>
            </div>
          </app-card>
        </div>
      </app-root>
    `;

    const componentsMap = new Map<Element, unknown>();
    const rootEl = document.querySelector('app-root')!;
    const cardEl = document.querySelector('app-card')!;
    const itemEl = document.querySelector('app-card-item')!;

    componentsMap.set(rootEl, { name: 'Root' });
    componentsMap.set(cardEl, { name: 'Card' });
    componentsMap.set(itemEl, { name: 'CardItem' });

    const mockNg: AngularDebugApi = {
      getComponent: (el: Element) => componentsMap.get(el) ?? null,
    };

    const nodes: ComponentTreeNode[] = [];
    walkAngularTree(rootEl, nodes, mockNg);

    expect(nodes.length).toBe(1);
    expect(nodes[0].selector).toBe('app-root');
    expect(nodes[0].children.length).toBe(1);
    expect(nodes[0].children[0].selector).toBe('app-card');
    expect(nodes[0].children[0].children.length).toBe(1);
    expect(nodes[0].children[0].children[0].selector).toBe('app-card-item');
  });

  it('collects component tree using global ng when available', () => {
    document.body.innerHTML = `
      <app-root ng-version="19.0.0">
        <div class="wrapper">
          <app-sidebar></app-sidebar>
        </div>
      </app-root>
    `;

    const componentsMap = new Map<Element, unknown>();
    const rootEl = document.querySelector('app-root')!;
    const sidebarEl = document.querySelector('app-sidebar')!;

    componentsMap.set(rootEl, { name: 'Root' });
    componentsMap.set(sidebarEl, { name: 'Sidebar' });

    (window as unknown as { ng?: AngularDebugApi }).ng = {
      getComponent: (el: Element) => componentsMap.get(el) ?? null,
    };

    const nodes = collectComponentTree();
    expect(nodes.length).toBe(1);
    expect(nodes[0].selector).toBe('app-root');
    expect(nodes[0].children.map((c) => c.selector)).toEqual(['app-sidebar']);
  });

  it('deduplicates nested roots and avoids adding nested roots twice', () => {
    document.body.innerHTML = `
      <app-root ng-version="19.0.0">
        <div class="container">
          <app-child _nghost-ng-c10></app-child>
        </div>
      </app-root>
    `;

    const componentsMap = new Map<Element, unknown>();
    const rootEl = document.querySelector('app-root')!;
    const childEl = document.querySelector('app-child')!;

    componentsMap.set(rootEl, { name: 'Root' });
    componentsMap.set(childEl, { name: 'Child' });

    (window as unknown as { ng?: AngularDebugApi }).ng = {
      getComponent: (el: Element) => componentsMap.get(el) ?? null,
    };

    const nodes = collectComponentTree();
    expect(nodes.length).toBe(1);
    expect(nodes[0].selector).toBe('app-root');
    expect(nodes[0].children.length).toBe(1);
    expect(nodes[0].children[0].selector).toBe('app-child');
  });

  it('falls back to walking document.body when window.ng is unavailable and roots is empty', () => {
    delete (window as unknown as { ng?: AngularDebugApi }).ng;

    document.body.innerHTML = `
      <custom-widget>
        <nested-item></nested-item>
      </custom-widget>
    `;

    const nodes = collectComponentTree();
    expect(nodes.length).toBe(1);
    expect(nodes[0].selector).toBe('custom-widget');
    expect(nodes[0].children.length).toBe(1);
    expect(nodes[0].children[0].selector).toBe('nested-item');
  });

  it('serializes signal results and non-function plain fields in tryGetInputs', () => {
    let arbitraryMethodCalled = false;
    const signalFn = function signalValueFn() {
      return { nested: 'value', count: 10 };
    };

    const regularMethod = () => {
      arbitraryMethodCalled = true;
      return 'should-not-run';
    };

    document.body.innerHTML = `<app-widget ng-version="19.0.0"></app-widget>`;
    const widgetEl = document.querySelector('app-widget')!;

    const mockComp = {
      signalInput: signalFn,
      plainObject: { theme: 'dark', active: true },
      plainPrimitive: 'hello',
      actionMethod: regularMethod,
    };

    (window as unknown as { ng?: AngularDebugApi }).ng = {
      getComponent: (el: Element) => (el === widgetEl ? mockComp : null),
    };

    const nodes = collectComponentTree();
    expect(nodes.length).toBe(1);
    expect(nodes[0].inputs).toEqual({
      signalInput: { nested: 'value', count: 10 },
      plainObject: { theme: 'dark', active: true },
      plainPrimitive: 'hello',
    });
    expect(arbitraryMethodCalled).toBe(false);
  });
});
