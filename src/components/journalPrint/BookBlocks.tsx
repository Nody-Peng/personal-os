import type { CSSProperties, ReactNode } from 'react'
import { parseNoteIcon } from '@/lib/noteIcons'
import { INK_NAMES } from './bookCss'

// A BlockNote document (stored JSON) printed on the journal's paper: no
// editor, just markup for Paged.js. Pictures become polaroids (several in a
// row share one), our own blocks become plain text (a linked page shows its
// title, a bookmark its title and site), and toggles print open.

type Loose = {
  id?: string
  type?: string
  props?: Record<string, unknown>
  content?: unknown
  children?: unknown
}
type Run = {
  type?: string
  text?: string
  href?: string
  styles?: Record<string, unknown>
  content?: unknown
}

export type BlockContext = { pageTitles: Record<number, string> }

const str = (v: unknown) => (typeof v === 'string' ? v : '')

function styled(text: string, styles: Record<string, unknown> | undefined, key: number): ReactNode {
  let node: ReactNode = text
  if (!styles) return node
  if (styles.code) node = <code className="inline">{node}</code>
  if (styles.bold) node = <strong>{node}</strong>
  if (styles.italic) node = <em>{node}</em>
  if (styles.underline) node = <u>{node}</u>
  if (styles.strike) node = <s>{node}</s>
  const color = str(styles.textColor)
  const bg = str(styles.backgroundColor)
  const classes = [INK_NAMES.has(color) ? `ink-${color}` : '', INK_NAMES.has(bg) ? `hl hl-${bg}` : ''].filter(Boolean).join(' ')
  return classes ? (
    <span key={key} className={classes}>
      {node}
    </span>
  ) : (
    <span key={key}>{node}</span>
  )
}

export function Inline({ content }: { content: unknown }): ReactNode {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return null
  return content.map((raw, i) => {
    const run = (raw ?? {}) as Run
    if (run.type === 'link') {
      return (
        <a key={i} href={str(run.href)}>
          <Inline content={run.content} />
        </a>
      )
    }
    return styled(str(run.text), run.styles, i)
  })
}

const childrenOf = (b: Loose): Loose[] => (Array.isArray(b.children) ? (b.children as Loose[]) : [])
const hasText = (content: unknown) => (typeof content === 'string' ? content.trim() !== '' : Array.isArray(content) && content.length > 0)

/** A tick drawn like a pen stroke. */
export function Tick() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden>
      <path d="M1.6 6.4 C2.8 7.4 3.8 8.6 4.6 10.2 C6.2 6.6 8.4 3.6 11.4 0.9" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function CheckBox({ done, moved = false }: { done: boolean; moved?: boolean }) {
  return <span className={`box${done ? ' done' : ''}${moved ? ' moved' : ''}`}>{done && <Tick />}</span>
}

function Polaroids({ images }: { images: Loose[] }) {
  return (
    <div className={`polaroids${images.length > 2 ? ' many' : ''}`}>
      {images.map((b, i) => {
        const url = str(b.props?.url)
        const caption = str(b.props?.caption)
        // Screenshots stay PNG when uploaded (lib/uploadMedia): show them whole rather than cropped.
        const whole = /\.png(?:$|\?)/i.test(url)
        return (
          <figure key={b.id ?? i} className="polaroid">
            <div className="photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- plain markup for Paged.js to copy */}
              {url && <img src={url} alt={caption} className={whole ? 'whole' : undefined} />}
            </div>
            <figcaption>{caption}</figcaption>
          </figure>
        )
      })}
    </div>
  )
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function Table({ content }: { content: unknown }) {
  const rows = (content as { rows?: unknown } | null)?.rows
  if (!Array.isArray(rows)) return null
  const headerRows = Number((content as { headerRows?: unknown }).headerRows) || 0
  return (
    <table className="tbl">
      <tbody>
        {rows.map((row, r) => {
          const cells = (row as { cells?: unknown } | null)?.cells
          return (
            <tr key={r}>
              {Array.isArray(cells) &&
                cells.map((cell, c) => {
                  // Cells are inline content, or { type: 'tableCell', content } in newer documents.
                  const inner = cell && typeof cell === 'object' && !Array.isArray(cell) ? (cell as { content?: unknown }).content : cell
                  const Cell = r < headerRows ? 'th' : 'td'
                  return (
                    <Cell key={c}>
                      <Inline content={inner} />
                    </Cell>
                  )
                })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ListItem({ mark, block, ctx }: { mark: ReactNode; block: Loose; ctx: BlockContext }) {
  return (
    <div className="li">
      <span className="mark">{mark}</span>
      <div className="body">
        <p>
          <Inline content={block.content} />
        </p>
        <Blocks blocks={childrenOf(block)} ctx={ctx} />
      </div>
    </div>
  )
}

function Block({ block, ctx, number }: { block: Loose; ctx: BlockContext; number: number }): ReactNode {
  const props = block.props ?? {}
  const kids = childrenOf(block)
  const nested = kids.length ? (
    <div className="nest">
      <Blocks blocks={kids} ctx={ctx} />
    </div>
  ) : null
  const color = str(props.textColor)
  const bg = str(props.backgroundColor)
  const tone = [INK_NAMES.has(color) ? `ink-${color}` : '', INK_NAMES.has(bg) ? `hl-${bg}` : ''].filter(Boolean).join(' ')
  const align: CSSProperties | undefined = props.textAlignment === 'center' || props.textAlignment === 'right' ? { textAlign: props.textAlignment } : undefined

  switch (block.type) {
    case 'paragraph':
      return (
        <>
          <p className={tone || undefined} style={align}>
            {hasText(block.content) ? <Inline content={block.content} /> : ' '}
          </p>
          {nested}
        </>
      )
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(props.level) || 1))
      return (
        <>
          <p className={`h${level}${tone ? ` ${tone}` : ''}`} style={align}>
            <Inline content={block.content} />
          </p>
          {nested}
        </>
      )
    }
    case 'bulletListItem':
      return <ListItem mark="•" block={block} ctx={ctx} />
    case 'numberedListItem':
      return <ListItem mark={`${number}.`} block={block} ctx={ctx} />
    case 'checkListItem':
      return <ListItem mark={<CheckBox done={props.checked === true} />} block={block} ctx={ctx} />
    case 'toggleListItem':
      return <ListItem mark="▸" block={block} ctx={ctx} />
    case 'quote':
      return (
        <div className="quote">
          <p>
            <Inline content={block.content} />
          </p>
          <Blocks blocks={kids} ctx={ctx} />
        </div>
      )
    case 'callout': {
      const icon = parseNoteIcon(str(props.emoji))
      return (
        <div className={`callout${tone ? ` ${tone}` : ''}`}>
          <span className="emoji">{icon?.kind === 'emoji' ? icon.emoji : '💡'}</span>
          <div>
            <p>
              <Inline content={block.content} />
            </p>
            <Blocks blocks={kids} ctx={ctx} />
          </div>
        </div>
      )
    }
    case 'codeBlock':
      return (
        <pre className="code">
          <Inline content={block.content} />
        </pre>
      )
    case 'divider':
      return <div className="divider">· · ·</div>
    case 'table':
      return <Table content={block.content} />
    case 'video':
    case 'audio':
    case 'file': {
      const name = str(props.name) || str(props.caption) || host(str(props.url)) || '檔案'
      return (
        <p className="chip">
          {block.type === 'video' ? '▶ ' : block.type === 'audio' ? '♪ ' : '📎 '}
          {name}
        </p>
      )
    }
    case 'pageLink':
    case 'board': {
      const id = Number(block.type === 'pageLink' ? props.pageId : props.boardId)
      const title = ctx.pageTitles[id]
      return title === undefined ? null : (
        <p className="chip">
          {block.type === 'board' ? '▦ ' : '↗ '}
          {title || '未命名'}
        </p>
      )
    }
    case 'bookmark':
    case 'embed': {
      const url = str(props.url)
      if (!url) return null
      return (
        <p className="chip">
          ↗ {str(props.title) || host(url) || url}
          {str(props.title) && <span className="site">{str(props.siteName) || host(url)}</span>}
        </p>
      )
    }
    case 'columnList':
      return (
        <div className="columns">
          {kids.map((col, i) => (
            <div key={col.id ?? i} className="col" style={{ flexGrow: Number(col.props?.width) || 1 }}>
              <Blocks blocks={childrenOf(col)} ctx={ctx} />
            </div>
          ))}
        </div>
      )
    case 'toc':
      return null
    default:
      // Unknown blocks: whatever text they hold.
      return hasText(block.content) ? (
        <p>
          <Inline content={block.content} />
        </p>
      ) : (
        nested
      )
  }
}

/** A list of blocks; runs of pictures are grouped into one row of polaroids. */
export function Blocks({ blocks, ctx }: { blocks: unknown; ctx: BlockContext }) {
  if (!Array.isArray(blocks) || !blocks.length) return null
  const list = blocks.filter((b): b is Loose => Boolean(b) && typeof b === 'object')
  const out: ReactNode[] = []
  let number = 0
  for (let i = 0; i < list.length; i++) {
    const block = list[i]
    if (block.type === 'image') {
      const run: Loose[] = []
      while (i < list.length && list[i].type === 'image') run.push(list[i++])
      i--
      const images = run.filter((b) => str(b.props?.url))
      if (images.length) out.push(<Polaroids key={images[0].id ?? `img-${i}`} images={images} />)
      number = 0
      continue
    }
    // Numbered items count up within a run of them (BlockNote's `start` sets the first number).
    number = block.type === 'numberedListItem' ? (number === 0 ? Number(block.props?.start) || 1 : number + 1) : 0
    out.push(<Block key={block.id ?? i} block={block} ctx={ctx} number={number} />)
  }
  return <div className="blocks">{out}</div>
}
