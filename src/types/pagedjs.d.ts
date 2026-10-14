// Paged.js ships without types; only what components/journalPrint uses.
declare module 'pagedjs' {
  export class Previewer {
    constructor(options?: Record<string, unknown>)
    /** Cuts `content` into pages inside `renderTo`, styled by `stylesheets` (URLs, or { [baseUrl]: cssText }). */
    preview(content?: Node, stylesheets?: (string | Record<string, string>)[], renderTo?: HTMLElement): Promise<{ total: number; performance: number }>
    on(event: 'page', handler: (page: unknown) => void): void
  }
}
