export interface TypingKey {
  key: string;
  keyCode?: number;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing: boolean;
}

/** Redirect text entry only; navigation, activation, and browser shortcuts stay native. */
export function typingAction(event: TypingKey, activatesControl = false): 'insert' | 'focus' | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.isComposing || event.key === 'Process' || event.key === 'Dead' || event.keyCode === 229) return 'focus';
  if (event.key === ' ' && activatesControl) return null;
  return [...event.key].length === 1 ? 'insert' : null;
}
