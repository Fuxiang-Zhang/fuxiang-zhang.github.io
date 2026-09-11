/** Five-row terminal lettering. Words wrap as units on narrow screens. */
const glyphs: Record<string, string[]> = {
  A: [' ███ ', '█   █', '█████', '█   █', '█   █'],
  F: ['█████', '█    ', '████ ', '█    ', '█    '],
  G: [' ████', '█    ', '█  ██', '█   █', ' ███ '],
  H: ['█   █', '█   █', '█████', '█   █', '█   █'],
  I: ['█████', '  █  ', '  █  ', '  █  ', '█████'],
  N: ['█   █', '██  █', '█ █ █', '█  ██', '█   █'],
  U: ['█   █', '█   █', '█   █', '█   █', ' ███ '],
  X: ['█   █', ' █ █ ', '  █  ', ' █ █ ', '█   █'],
  Z: ['█████', '   █ ', '  █  ', ' █   ', '█████'],
};

/** Unsupported names retain their plain text heading rather than incorrect lettering. */
export function nameBanner(name: string): string[] {
  const words = name.toUpperCase().trim().split(/\s+/);
  if (!words.every(word => [...word].every(letter => glyphs[letter]))) return [];
  return words.map(word => Array.from({ length: 5 }, (_, row) =>
    [...word].map(letter => glyphs[letter][row]).join(' ')).join('\n'));
}
