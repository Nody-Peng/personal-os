// Three-way merge of two editors' versions of one document, block by block
// (top-level blocks, matched by id; a block's children travel with it).
// `base` is what both started from, `local` the text in front of the user,
// `remote` what was saved elsewhere meanwhile (another tab, Claude).
//   - a block only one side changed takes that side's version
//   - a block both changed keeps the local one (what the user is looking at)
//   - new blocks from either side are kept, each after the block it followed
//   - a block one side deleted goes, unless the other side changed it
// Remote order is the frame; local-only blocks slot in after their predecessor.

type Block = { id?: unknown }

const keyOf = (b: Block): string | null => (typeof b.id === 'string' && b.id ? b.id : null)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function byId<T extends Block>(blocks: T[]): Map<string, T> {
  const map = new Map<string, T>()
  for (const b of blocks) {
    const k = keyOf(b)
    if (k) map.set(k, b)
  }
  return map
}

export function mergeBlocks<T extends Block>(base: T[], local: T[], remote: T[]): T[] {
  const baseMap = byId(base)
  const localMap = byId(local)
  const remoteMap = byId(remote)

  // Remote's blocks, as merged with the local side.
  const result: T[] = []
  for (const r of remote) {
    const k = keyOf(r)
    if (!k) {
      result.push(r)
      continue
    }
    const b = baseMap.get(k)
    const l = localMap.get(k)
    if (!b) {
      // New on the remote side (an id the local side somehow has too: prefer local).
      result.push(l ?? r)
      continue
    }
    if (!l) {
      // Deleted locally: gone, unless the remote side changed it since.
      if (!same(r, b)) result.push(r)
      continue
    }
    result.push(!same(l, b) ? l : r)
  }

  // Local blocks the remote side doesn't have: new ones, or ones it deleted
  // that were changed here. Each goes after the closest block before it.
  let previous: string | null = null
  for (const l of local) {
    const k = keyOf(l)
    if (k && remoteMap.has(k)) {
      previous = k
      continue
    }
    const b = k ? baseMap.get(k) : undefined
    const keep = !b || !same(l, b)
    if (keep) {
      const at = previous == null ? -1 : result.findIndex((x) => keyOf(x) === previous)
      // Its predecessor was dropped too: fall back to the next earlier one kept.
      let index = at
      if (previous != null && at === -1) {
        const order = local.map(keyOf)
        for (let i = order.indexOf(previous) - 1; i >= 0 && index === -1; i--) {
          const candidate = order[i]
          if (candidate) index = result.findIndex((x) => keyOf(x) === candidate)
        }
      }
      result.splice(index + 1, 0, l)
    }
    if (k) previous = k
  }
  return result
}
