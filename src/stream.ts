/*
 * Progressive reveal of a reply, token by token, in document order.
 * The renderer still produces complete HTML; the writer replays it into the
 * message body so headings, lists and links appear as the text reaches them.
 * A future backend can feed the same writer with streamed text instead.
 */
export interface RevealOptions {
  /** Called after every batch of tokens, e.g. to keep the newest text in view. */
  onStep?: () => void;
  /** Rough total duration in milliseconds; long replies stream faster to stay near it. */
  targetDuration?: number;
  /** Minimum interval between batches in milliseconds. */
  tick?: number;
}
export interface Reveal {
  done: Promise<void>;
  /** Stops the animation and shows the complete reply immediately. */
  cancel(): void;
}
type Step = { open: Element } | { close: true } | { text: string };

/** Splits text into word-like tokens that keep their trailing whitespace. */
export const tokenize = (text: string): string[] => text.match(/\S+\s*|\s+/g) ?? [];
/** Tokens per batch so a reply of any length finishes close to the target duration. */
export const tokensPerTick = (tokens: number, targetDuration: number, tick: number): number =>
  Math.max(1, Math.ceil(tokens / Math.max(1, targetDuration / tick)));

export function revealHTML(target: HTMLElement, html: string, options: RevealOptions = {}): Reveal {
  const source = document.createElement('div');
  source.innerHTML = html;
  const steps: Step[] = [];
  let tokens = 0;
  const plan = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        for (const token of tokenize(child.textContent ?? '')) {
          steps.push({ text: token });
          tokens += 1;
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        steps.push({ open: child as Element });
        plan(child);
        steps.push({ close: true });
      }
    }
  };
  plan(source);

  const tick = options.tick ?? 24;
  const perTick = tokensPerTick(tokens, options.targetDuration ?? 1600, tick);
  const cursor = document.createElement('span');
  cursor.className = 'stream-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  const stack: Node[] = [target];
  let current: Text | null = null;
  let index = 0;
  let last = 0;
  let frame = 0;
  let settled = false;
  let resolve!: () => void;
  const done = new Promise<void>(r => { resolve = r; });
  const settle = () => {
    if (settled) return;
    settled = true;
    cursor.remove();
    resolve();
  };
  const apply = (step: Step) => {
    const parent = stack[stack.length - 1];
    if ('open' in step) {
      const clone = step.open.cloneNode(false);
      parent.appendChild(clone);
      stack.push(clone);
      current = null;
    } else if ('close' in step) {
      stack.pop();
      current = null;
    } else {
      if (!current) {
        current = document.createTextNode('');
        parent.appendChild(current);
      }
      current.data += step.text;
    }
    (current?.parentNode ?? stack[stack.length - 1]).appendChild(cursor);
  };
  const run = (now: number) => {
    if (settled) return;
    if (now - last >= tick) {
      last = now;
      let budget = perTick;
      while (budget > 0 && index < steps.length) {
        const step = steps[index++];
        apply(step);
        if ('text' in step) budget -= 1;
      }
      // Structural steps at the end (closing tags) are free.
      while (index < steps.length && !('text' in steps[index])) apply(steps[index++]);
      options.onStep?.();
    }
    if (index < steps.length) frame = requestAnimationFrame(run);
    else settle();
  };
  target.innerHTML = '';
  target.appendChild(cursor);
  frame = requestAnimationFrame(run);
  return {
    done,
    cancel() {
      if (settled) return;
      cancelAnimationFrame(frame);
      target.innerHTML = html;
      settle();
    },
  };
}
