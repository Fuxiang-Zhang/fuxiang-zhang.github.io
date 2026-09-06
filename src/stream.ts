/*
 * Progressive reveal of a reply, token by token, in document order.
 * The renderer still produces complete HTML; the writer replays it into the
 * message body so headings, lists and links appear as the text reaches them.
 * A future backend can feed the same writer with streamed text instead.
 */
export interface RevealOptions {
  /** Insert these subtrees intact, without spending animation time on hidden text. */
  instantSelector?: string;
  /** Called after every batch of tokens, e.g. to keep the newest text in view. */
  onStep?: () => void;
  /** Reveal speed in tokens per second; the same for every reply regardless of length. */
  rate?: number;
  /** Minimum interval between batches in milliseconds. */
  tick?: number;
}
export interface Reveal {
  done: Promise<void>;
  /** Stops the animation and shows the complete reply immediately. */
  cancel(): void;
}
type Step = { open: Element } | { close: true } | { text: string } | { instant: Element } | { card: Element };

/** Splits text into word-like tokens that keep their trailing whitespace. */
export const tokenize = (text: string): string[] => text.match(/\S+\s*|\s+/g) ?? [];
/** Default reveal speed: a brisk reading pace, tokens per second. */
export const DEFAULT_RATE = 40;
/** Tokens that should be visible after `elapsed` milliseconds at a fixed rate. */
export const tokensDue = (elapsed: number, rate: number): number => Math.floor(Math.max(0, elapsed) * rate / 1000);

export function revealHTML(target: HTMLElement, html: string, options: RevealOptions = {}): Reveal {
  const source = document.createElement('div');
  source.innerHTML = html;
  const steps: Step[] = [];
  const plan = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        for (const token of tokenize(child.textContent ?? '')) {
          steps.push({ text: token });
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if ((child as Element).matches('.paper')) {
          steps.push({ card: child as Element });
          continue;
        }
        if (options.instantSelector && (child as Element).matches(options.instantSelector)) {
          steps.push({ instant: child as Element });
          continue;
        }
        steps.push({ open: child as Element });
        plan(child);
        steps.push({ close: true });
      }
    }
  };
  plan(source);

  const tick = options.tick ?? 24;
  const rate = options.rate ?? DEFAULT_RATE;
  const cursor = document.createElement('span');
  cursor.className = 'stream-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  const stack: Node[] = [target];
  let current: Text | null = null;
  let index = 0;
  let shown = 0;
  let start = 0;
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
    if ('card' in step) {
      const card = step.card.cloneNode(true) as HTMLElement;
      card.classList.add('paper-enter');
      card.addEventListener('animationend', () => card.classList.remove('paper-enter'), { once: true });
      parent.appendChild(card);
      current = null;
    } else if ('instant' in step) {
      parent.appendChild(step.instant.cloneNode(true));
      current = null;
    } else if ('open' in step) {
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
    if (!start) start = last = now;
    if (now - last >= tick) {
      last = now;
      // Time-based pacing keeps the speed steady across frame rates and reply lengths.
      let budget = tokensDue(now - start, rate) - shown;
      while (budget > 0 && index < steps.length) {
        const step = steps[index++];
        apply(step);
        if ('text' in step) { budget -= 1; shown += 1; }
        // Reserve a short beat for each complete card, including adjacent cards.
        if ('card' in step) { budget -= 12; shown += 12; }
      }
      // Structural steps at the end (closing tags) are free.
      while (index < steps.length && !('text' in steps[index]) && !('card' in steps[index])) apply(steps[index++]);
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
