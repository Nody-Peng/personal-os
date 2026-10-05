// Reads a web page's title, description, picture and icon from its HTML head
// (Open Graph / Twitter tags, <title>, <link rel=icon>) for bookmark cards.

export type LinkMeta = {
  url: string
  title: string
  description: string
  image: string
  siteName: string
  icon: string
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decode(value: string): string {
  return value
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole
      }
      return ENTITIES[code.toLowerCase()] ?? whole
    })
    .replace(/\s+/g, ' ')
    .trim()
}

function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''
  }
  return out
}

/** An absolute http(s) address, or ''. */
function absolute(href: string, base: string): string {
  try {
    const url = new URL(decode(href), base)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href.slice(0, 1000) : ''
  } catch {
    return ''
  }
}

export function parseLinkMeta(html: string, pageUrl: string): LinkMeta {
  const head = html.slice(0, 400_000)
  const meta = new Map<string, string>()
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributes(tag)
    const key = (a.property ?? a.name ?? a.itemprop ?? '').toLowerCase()
    if (key && a.content != null && !meta.has(key)) meta.set(key, a.content)
  }
  const pick = (...keys: string[]) => decode(keys.map((k) => meta.get(k)).find((v) => v && v.trim()) ?? '')

  let icon = ''
  for (const [tag] of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attributes(tag)
    const rel = (a.rel ?? '').toLowerCase()
    if (a.href && /(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/.test(rel)) {
      icon = absolute(a.href, pageUrl)
      // Prefer a plain icon over the big touch icon.
      if (!rel.includes('apple')) break
    }
  }
  const origin = (() => {
    try {
      return new URL(pageUrl).origin
    } catch {
      return ''
    }
  })()
  const host = origin.replace(/^https?:\/\/(www\.)?/, '')
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''

  return {
    url: pageUrl,
    title: (pick('og:title', 'twitter:title') || decode(titleTag) || host).slice(0, 300),
    description: pick('og:description', 'twitter:description', 'description').slice(0, 500),
    image: absolute(pick('og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'), pageUrl),
    siteName: (pick('og:site_name', 'application-name') || host).slice(0, 100),
    icon: icon || (origin ? `${origin}/favicon.ico` : ''),
  }
}
