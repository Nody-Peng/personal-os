import net from 'node:net'

// Addresses a server-side fetch must never reach: loopback, private networks,
// link-local (cloud metadata), carrier-grade NAT, multicast and reserved ranges.

function isPrivateV4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number)
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

/** The eight 16-bit groups of an IPv6 address (a trailing dotted IPv4 part included), or null. */
function groupsOf(v6: string): number[] | null {
  let text = v6
  const dotted = text.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) {
    if (!net.isIPv4(dotted[1])) return null
    const [a, b, c, d] = dotted[1].split('.').map(Number)
    text = text.slice(0, -dotted[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }
  const [head, tail, extra] = text.split('::')
  if (extra !== undefined) return null
  const part = (s: string) => (s ? s.split(':').map((g) => parseInt(g, 16)) : [])
  const left = part(head)
  const right = tail === undefined ? [] : part(tail)
  const fill = tail === undefined ? 0 : 8 - left.length - right.length
  const groups = [...left, ...Array<number>(Math.max(fill, 0)).fill(0), ...right]
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null
}

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateV4(ip)
  const v6 = ip.toLowerCase().replace(/%.*$/, '')
  const groups = groupsOf(v6)
  if (!groups) return true
  // IPv4-mapped (::ffff:a.b.c.d, which URLs rewrite as ::ffff:hhhh:hhhh) and
  // the old IPv4-compatible form (::a.b.c.d) reach the IPv4 address inside.
  if (groups.slice(0, 5).every((g) => g === 0) && (groups[5] === 0xffff || groups[5] === 0)) {
    return isPrivateV4(`${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`)
  }
  const first = groups[0]
  return (
    (first & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (first & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (first & 0xff00) === 0xff00 || // multicast
    (first === 0x64 && groups[1] === 0xff9b) || // NAT64
    (first === 0x2001 && groups[1] === 0xdb8) // documentation
  )
}
