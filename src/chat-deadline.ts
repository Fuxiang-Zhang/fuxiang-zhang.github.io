import { CHAT_TIMEOUT_MS } from './types.js';

/** One wall-clock deadline for the entire request, including streamed body reads. */
export function chatDeadline(parent?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), CHAT_TIMEOUT_MS);
  return {
    signal: parent ? AbortSignal.any([parent, controller.signal]) : controller.signal,
    dispose: () => clearTimeout(timer),
  };
}
