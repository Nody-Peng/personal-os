'use client'

// Panels (task panel, card peek) close on Esc. Menus and pickers opened inside
// them close themselves on Esc first: the editor's menus, and anything marked
// with `data-own-escape` (icon picker, code language picker, link pickers).
// Pickers that sit in the text (`data-own-escape="focus"`: link to page,
// bookmark, embed) only count while the focus is in them.

const OWN_ESCAPE = '[data-own-escape], .bn-suggestion-menu, .bn-grid-suggestion-menu, [role="menu"], .mantine-Popover-dropdown'

/** True while something on screen will handle Esc itself. */
export function escapeHandledElsewhere(): boolean {
  for (const el of document.querySelectorAll(OWN_ESCAPE)) {
    if (el.getAttribute('data-own-escape') !== 'focus' || el.contains(document.activeElement)) return true
  }
  return false
}
