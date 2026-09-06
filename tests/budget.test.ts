import test from 'node:test';
import assert from 'node:assert/strict';
import { createBudgetMonitor } from '../src/budget.js';
import type { ChatStatus } from '../src/types.js';

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('a failed midnight refresh retries and restores questions after the budget resets', async t => {
  const now = Date.UTC(2026, 8, 5, 23, 59);
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now });
  let calls = 0;
  const seen: ChatStatus[] = [];
  const monitor = createBudgetMonitor(async () => {
    if (++calls === 1) throw new Error('Temporary outage');
    return { mode: 'live', budget: { used: 0, limit: 100, exhausted: false, resetsAt: '2026-09-07T00:00:00Z' } };
  }, status => seen.push(status));
  t.after(() => monitor.dispose());
  monitor.update({ used: 100, limit: 100, exhausted: true, resetsAt: '2026-09-06T00:00:00Z' });
  t.mock.timers.tick(61_000);
  await flush();
  assert.equal(calls, 1);
  assert.equal(seen.length, 0);
  t.mock.timers.tick(60_000);
  await flush();
  assert.equal(calls, 2);
  assert.equal(seen[0].budget?.exhausted, false);
  t.mock.timers.tick(120_000);
  await flush();
  assert.equal(calls, 2, 'a healthy budget does not keep polling');
});

test('a later healthy budget cancels an already scheduled reset check', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const monitor = createBudgetMonitor(async () => { calls++; return { mode: 'mock', budget: null }; }, () => {});
  t.after(() => monitor.dispose());
  monitor.update({ used: 1, limit: 1, exhausted: true, resetsAt: new Date().toISOString() });
  monitor.update(null);
  t.mock.timers.tick(120_000);
  await flush();
  assert.equal(calls, 0);
});
