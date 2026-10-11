import type { Transaction } from 'prosemirror-state'

/**
 * Whether a `/` or `:` typed after `before` (the character just before the
 * caret, '' at the start of a line) starts a word, so its menu should open:
 * not inside 1/2, and/or, 10:30 or a web address. Chinese has no spaces, so
 * `/` right after a character like 和 still opens the slash menu (`afterCjk`);
 * the menu closes again when nothing matches.
 */
export function startsWord(before: string, afterCjk: boolean): boolean {
  return before === '' || /\s/.test(before) || (afterCjk && before.charCodeAt(0) > 0x7f)
}

const opensAt = (afterCjk: boolean) => (tr: Transaction) => {
  const { $from } = tr.selection
  return startsWord($from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset, undefined, ' '), afterCjk)
}

/** BlockNote `shouldOpen` rules for the slash and emoji menus. */
export const slashOpens = opensAt(true)
export const emojiOpens = opensAt(false)
