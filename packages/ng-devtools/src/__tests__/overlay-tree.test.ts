// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { collectComponentTree, walkAngularTree } from '../overlay.ts';

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

    const mockNg = {
      getComponent: (el: Element) => componentsMap.get(el) ?? null,
    };

    const nodes: any[] = [];
    walkAngularTree(rootEl, nodes, mockNg);

    expect(nodes.length).toBe(1);
    expect(nodes[0].selector).toBe('app-root');
    expect(nodes[0].children.map((c: any) => c.selector)).toEqual(['app-header', 'app-footer']);
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

    const mockNg = {
      getComponent: (el: Element) => componentsMap.get(el) ?? null,
    };

    const nodes: any[] = [];
    walkAngularTree(rootEl, nodes, mockNg);

    expect(nodes.length).toBe(1);
    expect(nodes[0].selector).toBe('app-root');
    expect(nodes[0].children.map((c: any) => c.selector)).toEqual([
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

    const mockNg = {
      getComponent: (el: Element) => componentsMap.get(el) ?? null,
    };

    const nodes: any[] = [];
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

    (window as any).ng = {
      getComponent: (el: Element) => componentsMap.get(el) ?? null,
    };

    const nodes = collectComponentTree();
    expect(nodes.length).toBe(1);
    expect(nodes[0].selector).toBe('app-root');
    expect(nodes[0].children.map((c: any) => c.selector)).toEqual(['app-sidebar']);
  });
});
