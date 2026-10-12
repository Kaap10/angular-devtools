import { createHostContext } from 'devframe/node';
import { beforeEach, describe, expect, it } from 'vitest';
import pangular, { createPangular } from '../devframe.ts';
import { actionBlockedMessage, type PangularConfig } from '../config.ts';
import { clearCalls, recordCall, recentCalls } from '../analog-server-log.ts';

async function boot(options?: PangularConfig) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await (options ? createPangular(options) : pangular).setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const call = async (tool: string, args: Record<string, unknown> = {}) =>
    ((await ctx.agent.invoke(`pangular:${tool}`, args)) as { markdown: string }).markdown;
  const manifest = ctx.agent.list();
  const tools = manifest.tools.map((t) => t.id.replace(/^pangular:/, ''));
  return { ctx, push, call, tools };
}

function routerReport(pageId: string, navigations: unknown[] = []) {
  return {
    pageId,
    generation: 1,
    snapshot: {
      url: '/',
      queryParams: {},
      fragment: null,
      root: { path: '', url: '', outlet: 'primary', params: {}, data: {}, children: [] },
    },
    navigations,
  };
}

function httpReport(pageId: string, calls: unknown[] = []) {
  return {
    pageId,
    url: 'http://localhost:4200/',
    payload: { entries: [] },
    calls,
  };
}

describe('clear-recordings agent tool', () => {
  beforeEach(() => {
    clearCalls();
  });

  it('rejects missing or invalid target arguments', async () => {
    const { call } = await boot();
    await expect(call('clear-recordings', {})).rejects.toThrow(
      'Provide a valid target: "http", "router", "analog", or "all".',
    );
    await expect(call('clear-recordings', { target: 'invalid' })).rejects.toThrow(
      'Provide a valid target: "http", "router", "analog", or "all".',
    );
  });

  it('clears recorded HTTP calls when target is http', async () => {
    const { push, call } = await boot();
    await push(
      'push-http',
      httpReport('page-1', [
        {
          id: 'call-1',
          url: '/api/data',
          method: 'GET',
          status: 200,
          durationMs: 12,
          side: 'client',
        },
      ]),
    );

    const before = await call('list-http-calls');
    expect(before).toContain('/api/data');

    const result = await call('clear-recordings', { target: 'http' });
    expect(result).toBe('Cleared recorded HTTP calls.');

    const after = await call('list-http-calls');
    expect(after).not.toContain('/api/data');
    expect(after).toContain('No HttpClient calls recorded');
  });

  it('clears router navigations across all pages when target is router without page', async () => {
    const { push, call } = await boot();
    const nav1 = {
      id: 1,
      url: '/home',
      trigger: 'imperative',
      startedAt: 1000,
      endedAt: 1020,
      outcome: 'succeeded',
    };
    const nav2 = {
      id: 2,
      url: '/about',
      trigger: 'imperative',
      startedAt: 1030,
      endedAt: 1050,
      outcome: 'succeeded',
    };

    await push('push-router', routerReport('page-1', [nav1]));
    await push('push-router', routerReport('page-2', [nav2]));

    const beforeP1 = await call('explain-navigation', { page: 'page-1' });
    expect(beforeP1).toContain('/home');

    const result = await call('clear-recordings', { target: 'router' });
    expect(result).toBe('Cleared router navigations.');

    const afterP1 = await call('explain-navigation', { page: 'page-1' });
    expect(afterP1).not.toContain('/home');
    expect(afterP1).toContain('No navigations recorded');
  });

  it('clears router navigations for a specific page when page argument is provided', async () => {
    const { push, call } = await boot();
    await push(
      'push-router',
      routerReport('page-1', [
        {
          id: 1,
          url: '/page1-nav',
          trigger: 'imperative',
          startedAt: 1000,
          endedAt: 1020,
          outcome: 'succeeded',
        },
      ]),
    );
    await push(
      'push-router',
      routerReport('page-2', [
        {
          id: 2,
          url: '/page2-nav',
          trigger: 'imperative',
          startedAt: 1030,
          endedAt: 1050,
          outcome: 'succeeded',
        },
      ]),
    );

    const result = await call('clear-recordings', { target: 'router', page: 'page-1' });
    expect(result).toBe('Cleared router navigations for page "page-1".');

    const afterP1 = await call('explain-navigation', { page: 'page-1' });
    expect(afterP1).toContain('No navigations recorded');

    const afterP2 = await call('explain-navigation', { page: 'page-2' });
    expect(afterP2).toContain('/page2-nav');
  });

  it('clears Analog server calls when target is analog', async () => {
    const { call } = await boot();
    recordCall({
      at: Date.now(),
      kind: 'api',
      method: 'GET',
      url: '/api/users',
      status: 200,
      ms: 15,
      from: 'browser',
    });
    expect(recentCalls().length).toBe(1);

    const result = await call('clear-recordings', { target: 'analog' });
    expect(result).toBe('Cleared Analog server calls.');
    expect(recentCalls().length).toBe(0);
  });

  it('clears all targets when target is all', async () => {
    const { push, call } = await boot();
    await push(
      'push-http',
      httpReport('page-1', [
        {
          id: 'call-all',
          url: '/api/test',
          method: 'GET',
          status: 200,
          durationMs: 10,
          side: 'client',
        },
      ]),
    );
    await push(
      'push-router',
      routerReport('page-1', [
        {
          id: 1,
          url: '/nav-all',
          trigger: 'imperative',
          startedAt: 1000,
          endedAt: 1020,
          outcome: 'succeeded',
        },
      ]),
    );
    recordCall({
      at: Date.now(),
      kind: 'api',
      method: 'GET',
      url: '/api/all',
      status: 200,
      ms: 5,
      from: 'browser',
    });

    const result = await call('clear-recordings', { target: 'all' });
    expect(result).toBe('Cleared recorded HTTP calls, router navigations, Analog server calls.');

    const httpAfter = await call('list-http-calls');
    expect(httpAfter).toContain('No HttpClient calls recorded');
    expect(recentCalls().length).toBe(0);
  });

  it('enforces safety gating when actions.* are disabled', async () => {
    const httpBlocked = await boot({ actions: { http: false } });
    await expect(httpBlocked.call('clear-recordings', { target: 'http' })).rejects.toThrow(
      actionBlockedMessage('http'),
    );

    const routerBlocked = await boot({ actions: { router: false } });
    await expect(routerBlocked.call('clear-recordings', { target: 'router' })).rejects.toThrow(
      actionBlockedMessage('router'),
    );

    const analogBlocked = await boot({ actions: { analog: false } });
    await expect(analogBlocked.call('clear-recordings', { target: 'analog' })).rejects.toThrow(
      actionBlockedMessage('analog'),
    );
  });

  it('partially skips disabled targets and reports them when target is all', async () => {
    const { call } = await boot({ actions: { http: false, analog: false } });
    const result = await call('clear-recordings', { target: 'all' });
    expect(result).toContain('Cleared router navigations.');
    expect(result).toContain(
      'Skipped: HTTP calls (actions.http is turned off), Analog calls (actions.analog is turned off).',
    );
  });

  it('drops clear-recordings in read-only mode', async () => {
    const { tools } = await boot({ agent: { readOnly: true } });
    expect(tools).not.toContain('clear-recordings');
  });

  it('drops clear-recordings when all related inspectors are turned off', async () => {
    const { tools } = await boot({
      agent: { tools: { http: false, router: false, analog: false } },
    });
    expect(tools).not.toContain('clear-recordings');
  });
});
