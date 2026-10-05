// The Personal OS mark: a sun rising behind an open book ("每天一頁").
// One source of truth for the in-app <Logo> and scripts/generate-icons.ts.

export const BRAND_NAVY = '#1d2840'
export const BRAND_GOLD = '#d4b26e'

const LEFT_PAGE = 'M256 386 C214 354 164 342 104 346 L104 250 C164 246 214 260 256 290 Z'
const RIGHT_PAGE = 'M256 386 C298 354 348 342 408 346 L408 250 C348 246 298 260 256 290 Z'

export type LogoOptions = {
  /** rounded: app-style tile; square: full bleed (maskable / Apple, the OS crops it). */
  background?: 'rounded' | 'square' | 'none'
  /** Scales the mark around the centre (keep maskable icons inside the safe zone). */
  scale?: number
  /** Bigger sun and wider gaps so the mark survives 16–32 px favicons. */
  bold?: boolean
}

/** Geometry of the mark, centred optically in a 512 × 512 box. */
export function logoParts({ scale = 1.08, bold = false }: Pick<LogoOptions, 'scale' | 'bold'> = {}) {
  const offset = (512 * (1 - scale)) / 2
  return {
    // The mark sits a little high on its own, so nudge it down to the optical centre.
    transform: `translate(${offset} ${offset + 14 * scale}) scale(${scale})`,
    sun: { cx: 256, cy: 226, r: bold ? 74 : 64 },
    pages: [LEFT_PAGE, RIGHT_PAGE],
    gap: bold ? 22 : 16,
  }
}

/** Standalone SVG markup, for generating icon files. */
export function logoSvg({ background = 'rounded', scale = 1.08, bold = false }: LogoOptions = {}): string {
  const p = logoParts({ scale, bold })
  const bg =
    background === 'none'
      ? ''
      : `<rect width="512" height="512" ${background === 'rounded' ? 'rx="112" ' : ''}fill="${BRAND_NAVY}"/>`
  const pages = p.pages
    .map(
      (d) =>
        `<path d="${d}" fill="${BRAND_GOLD}" stroke="${BRAND_NAVY}" stroke-width="${p.gap}" stroke-linejoin="round"/>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}<g transform="${p.transform}"><circle cx="${p.sun.cx}" cy="${p.sun.cy}" r="${p.sun.r}" fill="${BRAND_GOLD}"/>${pages}</g></svg>`
}
