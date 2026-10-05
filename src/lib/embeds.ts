// Turns a pasted page address into something a frame can show (the embed
// block): known services get their player/preview URL and a good size; any
// other https page is framed as is (some refuse, so the block always offers a
// link to the original too).

export type Embed = {
  src: string
  provider: string
  /** Height ÷ width for players that keep a ratio (16:9 → 0.5625). */
  ratio?: number
  /** Default height in px otherwise. */
  height: number
}

const VIDEO = 9 / 16

function parse(raw: string): URL | null {
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

const host = (url: URL) => url.hostname.replace(/^www\.|^m\./, '')

/** Seconds from YouTube's t=1h2m3s / t=90 / start=90. */
function youtubeStart(url: URL): number {
  const t = url.searchParams.get('t') ?? url.searchParams.get('start') ?? ''
  if (/^\d+$/.test(t)) return Number(t)
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0
}

export function toEmbed(raw: string): Embed | null {
  const url = parse(raw)
  if (!url) return null
  const h = host(url)
  const path = url.pathname

  if (h === 'youtube.com' || h === 'youtu.be' || h === 'youtube-nocookie.com' || h === 'music.youtube.com') {
    const id =
      h === 'youtu.be'
        ? path.slice(1).split('/')[0]
        : (url.searchParams.get('v') ?? path.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,})/)?.[1] ?? '')
    if (/^[\w-]{6,}$/.test(id)) {
      const start = youtubeStart(url)
      const shorts = path.startsWith('/shorts/')
      return {
        src: `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}`,
        provider: 'YouTube',
        ...(shorts ? { height: 560 } : { ratio: VIDEO, height: 400 }),
      }
    }
  }

  if (h === 'vimeo.com') {
    const id = path.match(/^\/(\d+)/)?.[1]
    if (id) return { src: `https://player.vimeo.com/video/${id}`, provider: 'Vimeo', ratio: VIDEO, height: 400 }
  }

  if ((h === 'google.com' && path.startsWith('/maps')) || h === 'maps.google.com') {
    if (path.startsWith('/maps/embed')) return { src: url.href, provider: 'Google 地圖', height: 420 }
    const place = path.match(/\/maps\/(?:place|search)\/([^/]+)/)?.[1]
    const coords = path.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    const q = url.searchParams.get('q') ?? (place ? decodeURIComponent(place.replace(/\+/g, ' ')) : coords ? `${coords[1]},${coords[2]}` : '')
    if (q) return { src: `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`, provider: 'Google 地圖', height: 420 }
  }

  if (h === 'docs.google.com') {
    const m = path.match(/^\/(document|spreadsheets|presentation|forms)\/d\/(e\/)?([\w-]+)/)
    if (m) {
      const [, kind, published, id] = m
      const base = `https://docs.google.com/${kind}/d/${published ?? ''}${id}`
      const src =
        kind === 'forms' ? `${base}/viewform?embedded=true` : kind === 'presentation' ? `${base}/embed` : `${base}/preview`
      const provider = { document: 'Google 文件', spreadsheets: 'Google 試算表', presentation: 'Google 簡報', forms: 'Google 表單' }[kind]!
      return { src, provider, height: kind === 'presentation' ? 420 : 600, ...(kind === 'presentation' ? { ratio: VIDEO } : {}) }
    }
  }

  if (h === 'drive.google.com') {
    const id = path.match(/^\/file\/d\/([\w-]+)/)?.[1]
    if (id) return { src: `https://drive.google.com/file/d/${id}/preview`, provider: 'Google 雲端硬碟', height: 480 }
  }

  if (h === 'figma.com' && /^\/(file|design|proto|board|slides)\//.test(path)) {
    return { src: `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url.href)}`, provider: 'Figma', height: 450 }
  }

  if (h === 'open.spotify.com') {
    const m = path.match(/^\/(?:intl-[\w-]+\/)?(track|album|playlist|episode|show|artist)\/(\w+)/)
    if (m) return { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, provider: 'Spotify', height: m[1] === 'track' || m[1] === 'episode' ? 152 : 352 }
  }

  if (h === 'codepen.io') {
    const m = path.match(/^\/([\w-]+)\/(?:pen|full|details)\/(\w+)/)
    if (m) return { src: `https://codepen.io/${m[1]}/embed/${m[2]}?default-tab=result`, provider: 'CodePen', height: 400 }
  }

  if (h === 'loom.com') {
    const id = path.match(/^\/(?:share|embed)\/(\w+)/)?.[1]
    if (id) return { src: `https://www.loom.com/embed/${id}`, provider: 'Loom', ratio: VIDEO, height: 400 }
  }

  if (h === 'bilibili.com') {
    const bvid = path.match(/^\/video\/(BV\w+)/)?.[1]
    if (bvid) return { src: `https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=0`, provider: 'bilibili', ratio: VIDEO, height: 400 }
  }

  // Anything else: frame the page itself (https only; many sites allow it).
  if (url.protocol === 'https:') return { src: url.href, provider: h, height: 480 }
  return null
}

/** A known service (not just "try to frame it"). */
export const isKnownEmbed = (raw: string) => {
  const url = parse(raw)
  const embed = toEmbed(raw)
  return Boolean(url && embed && embed.provider !== host(url))
}

/** A whole paste that is one web address. */
export function isUrl(text: string): boolean {
  const t = text.trim()
  return /^https?:\/\/\S+$/i.test(t) && parse(t) != null
}
