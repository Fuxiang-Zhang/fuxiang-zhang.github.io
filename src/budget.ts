import type { BudgetStatus, ChatStatus } from './types.js';

/** Recheck exhausted budgets at reset time, retrying transient status failures. */
export function createBudgetMonitor(readStatus: () => Promise<ChatStatus>, onStatus: (status: ChatStatus) => void) {
  let budget: BudgetStatus | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const schedule = (delay: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => void refresh(), delay);
  };
  function update(status: BudgetStatus | null) {
    budget = status;
    clearTimeout(timer);
    if (!disposed && budget?.exhausted) {
      schedule(Math.min(Math.max(Date.parse(budget.resetsAt) - Date.now(), 60_000) + 1000, 2_147_000_000));
    }
  }
  async function refresh() {
    try {
      const status = await readStatus();
      if (disposed) return;
      update(status.budget);
      onStatus(status);
    } catch {
      if (!disposed && budget?.exhausted) schedule(60_000);
    }
  }
  return { update, refresh, dispose() { disposed = true; clearTimeout(timer); } };
}
