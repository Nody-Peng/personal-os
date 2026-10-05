'use client'

// Panels (task panel, card peek) close on Esc. Menus and pickers opened inside
// them close themselves on Esc first: the editor's menus, and anything marked
// with `data-own-escape` (icon picker, code language picker, link pickers).

const OWN_ESCAPE = '[data-own-escape], .bn-suggestion-menu, .bn-grid-suggestion-menu, [role="menu"], .mantine-Popover-dropdown'

/** True while something on screen will handle Esc itself. */
export function escapeHandledElsewhere(): boolean {
  return document.querySelector(OWN_ESCAPE) != null
}
