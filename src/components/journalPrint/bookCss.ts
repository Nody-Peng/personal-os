// The journal book's stylesheet, handed to Paged.js (which reads its @page
// rules, page names, running heads and TOC page numbers). The paper has its
// own palette, like the e-book reader's: a printed page doesn't follow the
// app's light/dark theme. Ink tints are mixed here, as plain hex colours,
// because Paged.js re-parses the sheet with an old CSS parser.

import { COVER_COLORS } from '@/lib/options'
import { BOOK_FONTS, PAPER_TONES, type BookOptions } from '@/lib/journalPrint'

const SIZES = {
  // mm. Ruled lines every `line`; all text sits on them.
  a5: { width: 148, height: 210, top: 16, bottom: 16, inner: 18, outer: 13, line: 6, font: 10.5 },
  a4: { width: 210, height: 297, top: 20, bottom: 20, inner: 24, outer: 18, line: 7.5, font: 12.5 },
} as const

// BlockNote's text and highlight colours, as pens and highlighters on paper.
const INK: Record<string, [string, string]> = {
  gray: ['#857f75', '#e9e5dc'],
  brown: ['#8a5a3c', '#eadcce'],
  red: ['#b4473a', '#f6d8d2'],
  orange: ['#c0782c', '#f8e1c6'],
  yellow: ['#a98b22', '#f7eab0'],
  green: ['#4f7a4a', '#dcebd2'],
  blue: ['#3d5f8f', '#d8e4f1'],
  purple: ['#6f5596', '#e6ddf0'],
  pink: ['#b4587a', '#f5dbe5'],
}

const INK_CLASSES = Object.entries(INK)
  .map(([name, [text, bg]]) => `.ink-${name} { color: ${text}; }\n.hl-${name} { background: ${bg}; }`)
  .join('\n')

export const INK_NAMES = new Set(Object.keys(INK))

export const sizeOf = (o: BookOptions) => SIZES[o.size]

function mix(a: string, b: string, t: number): string {
  const c = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  const out = [0, 1, 2].map((i) => Math.round(c(a, i) * t + c(b, i) * (1 - t)))
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export function coverHex(color: string): string {
  return (COVER_COLORS.find((c) => c.value === color) ?? COVER_COLORS[0]).hex
}

export function bookCss(o: BookOptions, coverColor: string): string {
  const s = SIZES[o.size]
  const paper = (PAPER_TONES.find((t) => t.value === o.tone) ?? PAPER_TONES[0]).hex
  const ink = '#2b2824'
  const accent = coverHex(coverColor)
  const family = (BOOK_FONTS.find((f) => f.value === o.font) ?? BOOK_FONTS[0]).family
  const rule = mix(o.tone === 'cream' ? '#8c7a5b' : '#7d7d7d', paper, 0.3)
  const contentHeight = s.height - s.top - s.bottom

  const ruled =
    o.paper === 'lined'
      ? `background-image: linear-gradient(to bottom, transparent calc(var(--line) - 0.25mm), var(--rule) calc(var(--line) - 0.25mm), var(--rule) var(--line)); background-size: 100% var(--line); background-position: 0 -1mm;`
      : o.paper === 'dots'
        ? `background-image: radial-gradient(circle, var(--rule) 0.32mm, transparent 0.42mm); background-size: var(--line) var(--line); background-position: calc(var(--line) / -2) calc(var(--line) / -2 - 1mm);`
        : ''

  return `
:root {
  --paper: ${paper};
  --ink: ${ink};
  --soft: ${mix(ink, paper, 0.62)};
  --faint: ${mix(ink, paper, 0.38)};
  --rule: ${rule};
  --accent: ${accent};
  --accent-soft: ${mix(accent, paper, 0.55)};
  --accent-tint: ${mix(accent, paper, 0.14)};
  --accent-wash: ${mix(accent, paper, 0.07)};
  --line: ${s.line}mm;
  --fs: ${s.font}pt;
  --hand: '${family}', 'Iansui', 'LXGW WenKai TC', 'Kaiti TC', 'DFKai-SB', serif;
  --latin: 'Caveat', '${family}', cursive;
  --content-height: ${contentHeight}mm;
  --page-height: ${s.height}mm;
  --photo: ${o.size === 'a5' ? 10 : 12};
  --photo-small: ${o.size === 'a5' ? 7 : 8};
}

@page {
  size: ${o.size.toUpperCase()};
  margin: ${s.top}mm ${s.outer}mm ${s.bottom}mm ${s.inner}mm;
}
@page :left {
  margin-left: ${s.outer}mm;
  margin-right: ${s.inner}mm;
  @top-left { content: string(month); }
  @bottom-left { content: counter(page); }
}
@page :right {
  margin-left: ${s.inner}mm;
  margin-right: ${s.outer}mm;
  @top-right { content: string(month); }
  @bottom-right { content: counter(page); }
}
@page cover {
  margin: 0;
  @top-left { content: none; }
  @top-right { content: none; }
  @bottom-left { content: none; }
  @bottom-right { content: none; }
}
@page front {
  @top-left { content: none; }
  @top-right { content: none; }
}
@page month {
  @top-left { content: none; }
  @top-right { content: none; }
}
@page summary {
  @top-left { content: none; }
  @top-right { content: none; }
}

.pagedjs_page {
  background: var(--paper);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.pagedjs_cover_page {
  background: ${accent};
}
.pagedjs_day_page .pagedjs_area,
.pagedjs_week_page .pagedjs_area,
.pagedjs_monthend_page .pagedjs_area {
  ${ruled}
}
.pagedjs_margin-content {
  font-family: var(--hand);
  font-size: 8pt;
  color: var(--soft);
  letter-spacing: 0.08em;
}

/* ---- the book's text ---- */
.bk {
  font-family: var(--hand);
  font-size: var(--fs);
  line-height: var(--line);
  color: var(--ink);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.bk * {
  box-sizing: border-box;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.bk p, .bk ul, .bk ol, .bk h1, .bk h2, .bk h3, .bk h4, .bk figure, .bk blockquote, .bk pre, .bk table {
  margin: 0;
  padding: 0;
}
.bk ul, .bk ol { list-style: none; }
.bk h1, .bk h2, .bk h3, .bk h4 { font-weight: normal; }
.bk .latin { font-family: var(--latin); }
.bk .soft { color: var(--soft); }
.bk .faint { color: var(--faint); }
.bk .num { font-variant-numeric: tabular-nums; }
.bk .run-month {
  string-set: month content(text);
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.bk .label {
  color: var(--accent);
  letter-spacing: 0.12em;
}
.bk .gap { height: var(--line); }

/* checkboxes and marks, drawn so they print the same everywhere */
.bk .box {
  display: inline-block;
  position: relative;
  width: 0.82em;
  height: 0.82em;
  margin-right: 0.35em;
  border: 0.25mm solid var(--soft);
  border-radius: 0.12em;
  vertical-align: -0.08em;
}
.bk .box.done { border-color: var(--accent); }
.bk .box svg {
  position: absolute;
  left: -0.05em;
  top: -0.32em;
  width: 1.05em;
  height: 1.05em;
  overflow: visible;
}
.bk .box.moved { border-style: dashed; }
.bk .moved-text { color: var(--faint); text-decoration: line-through; text-decoration-color: var(--faint); }
.bk .dot {
  display: inline-block;
  width: 0.62em;
  height: 0.62em;
  margin-right: 0.18em;
  border-radius: 50%;
  border: 0.25mm solid var(--soft);
  vertical-align: -0.02em;
}
.bk .dot.on { background: var(--accent); border-color: var(--accent); }

/* ---- cover ---- */
.bk-cover {
  page: cover;
  break-before: page;
  position: relative;
  height: calc(var(--page-height) - 1mm);
  overflow: hidden;
  font-family: var(--hand);
  --gold: #d2b574;
}
.bk-cover .spine {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 5%;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.35), rgba(255, 255, 255, 0.08) 45%, rgba(0, 0, 0, 0.25));
}
.bk-cover .crease {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 5%;
  width: 0.3mm;
  background: rgba(0, 0, 0, 0.3);
}
.bk-cover .foil {
  position: absolute;
  top: 9%;
  bottom: 9%;
  left: calc(5% + 9%);
  right: 9%;
  border: 0.35mm solid rgba(210, 181, 116, 0.45);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 10% 6%;
  text-align: center;
  color: var(--gold);
  text-shadow: 0 0.2mm 0 rgba(0, 0, 0, 0.35);
}
.bk-cover .brand { font-family: var(--latin); font-size: 1.1em; letter-spacing: 0.3em; opacity: 0.85; }
.bk-cover .year { font-family: var(--latin); font-size: 4.2em; line-height: 1; letter-spacing: 0.06em; }
.bk-cover .rule { width: 22%; height: 0.3mm; margin: 5mm auto; background: rgba(210, 181, 116, 0.6); }
.bk-cover .title { font-size: 1.7em; line-height: 1.5; letter-spacing: 0.4em; padding-left: 0.4em; }
.bk-cover .subtitle { margin-top: 3mm; font-size: 1em; line-height: 1.6; opacity: 0.85; letter-spacing: 0.12em; }
.bk-cover .range { font-size: 0.95em; letter-spacing: 0.12em; opacity: 0.85; }
.bk-cover.back .foil { justify-content: flex-end; border-color: transparent; }

/* ---- title page and contents ---- */
.bk-front { page: front; break-before: page; }
.bk-title-page { padding-top: calc(var(--line) * 6); text-align: center; }
.bk-title-page .title { font-size: 2em; line-height: calc(var(--line) * 2); letter-spacing: 0.2em; }
.bk-title-page .subtitle { color: var(--soft); }
.bk-title-page .owner { margin: calc(var(--line) * 4) auto 0; width: 70%; text-align: left; color: var(--soft); }
.bk-title-page .owner .write { height: calc(var(--line) * 2); border-bottom: 0.3mm solid var(--rule); }
.bk-title-page .facts { margin-top: calc(var(--line) * 3); color: var(--soft); }

.bk-heading { font-size: 1.9em; line-height: calc(var(--line) * 2); letter-spacing: 0.1em; }
.bk-heading .latin { font-size: 0.8em; margin-left: 0.5em; color: var(--accent); letter-spacing: 0.04em; }
.bk-toc { margin-top: var(--line); }
.bk-toc .row { display: flex; align-items: baseline; }
.bk-toc .row .name { white-space: nowrap; }
.bk-toc .row .name .latin { margin-left: 0.4em; color: var(--accent); }
.bk-toc .row .leader { flex: 1; margin: 0 2mm; border-bottom: 0.3mm dotted var(--faint); transform: translateY(-1mm); }
.bk-toc a { color: inherit; text-decoration: none; }
.bk-toc a.page::after { content: target-counter(attr(href), page); }
.bk-toc .weeks { padding-left: 2.5em; font-size: 0.8em; color: var(--soft); }
.bk-toc .weeks a { margin-right: 0.9em; white-space: nowrap; }
.bk-toc .weeks a::after { content: ' ' target-counter(attr(href), page); color: var(--faint); }
.bk-toc .month-row { margin-top: calc(var(--line) / 2); }

/* ---- month opener and charts ---- */
.bk-month { page: month; break-before: page; }
.bk-month .year { font-family: var(--latin); color: var(--soft); font-size: 1.4em; }
.bk-month .month-name { font-size: 3.6em; line-height: calc(var(--line) * 4); letter-spacing: 0.1em; }
.bk-month .latin-name { font-family: var(--latin); font-size: 2em; color: var(--accent); line-height: calc(var(--line) * 2); }
.bk-month .rule { width: 30mm; height: 0.4mm; background: var(--accent); margin: var(--line) 0; }
.bk-section-title { margin-top: var(--line); }
.bk-section-title .label { font-size: 0.9em; }

.cal { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; row-gap: 0; margin-top: calc(var(--line) / 2); }
.cal .wd { color: var(--faint); font-size: 0.8em; }
.cal .d { position: relative; z-index: 0; height: calc(var(--line) * 1.4); line-height: calc(var(--line) * 1.4); font-family: var(--latin); font-size: 1.25em; }
.cal .d.out { color: var(--rule); }
.cal .d.rec::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(var(--line) * 1.05);
  height: calc(var(--line) * 1.05);
  transform: translate(-50%, -50%) rotate(-8deg);
  border-radius: 46% 54% 50% 50%;
  border: 0.35mm solid var(--accent);
  z-index: -1;
}
.cal .d.all::before { background: var(--accent-tint); }

.tiles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 4mm; margin-top: var(--line); }
.tiles.four { grid-template-columns: repeat(4, 1fr); }
.tile { border-top: 0.3mm solid var(--rule); padding-top: 1mm; margin-bottom: 2mm; }
.tile .k { font-size: 0.78em; color: var(--soft); line-height: 1.6; }
.tile .v { font-family: var(--latin); font-size: 1.9em; line-height: 1.2; }
.tile .v small { font-family: var(--hand); font-size: 0.45em; color: var(--soft); margin-left: 0.6em; }
.facts-line { color: var(--soft); font-size: 0.85em; margin-top: 1mm; }

.fig { break-inside: avoid; margin-top: var(--line); }
.chart { margin-top: calc(var(--line) / 2); width: 100%; background: var(--paper); }
.chart svg { display: block; width: 100%; height: auto; overflow: visible; }
.chart text { font-family: var(--hand); fill: var(--soft); }
.chart .axis { stroke: var(--rule); stroke-width: 0.25; }
.chart .grid { stroke: var(--rule); stroke-width: 0.2; stroke-dasharray: 0.8 0.8; }
.chart .series { stroke: var(--accent); fill: none; stroke-width: 0.6; stroke-linecap: round; stroke-linejoin: round; }
.chart .mark { fill: var(--accent); }
.chart .mark-off { fill: var(--accent-tint); }
.chart .avg { stroke: var(--soft); stroke-width: 0.3; stroke-dasharray: 1.2 1; }
.chart .value { fill: var(--ink); }
.chart .empty { fill: var(--faint); }

.tracker { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: calc(var(--line) / 2); background: var(--paper); }
.tracker th, .tracker td { padding: 0; text-align: center; font-weight: normal; }
.tracker thead th { font-size: 0.55em; color: var(--faint); line-height: 1.6; }
.tracker .name { text-align: left; font-size: 0.82em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tracker td { height: calc(var(--line) * 0.95); }
.tracker .c { display: inline-block; width: 70%; max-width: 2.6mm; aspect-ratio: 1; border-radius: 50%; border: 0.2mm solid var(--rule); vertical-align: middle; }
.tracker .c.on { background: var(--accent); border-color: var(--accent); }
.tracker .c.out { border-color: transparent; }
.tracker .total { font-family: var(--latin); font-size: 1.05em; }
.tracker tr.week-row td { height: calc(var(--line) * 1.1); }
.tracker tr.week-row .c { max-width: 4mm; width: 55%; }

/* ---- a day ---- */
.bk-day { page: day; break-before: page; }
.bk-day .head { display: flex; align-items: flex-end; height: calc(var(--line) * 2); }
.bk-day .head .date { font-family: var(--latin); font-size: 2.6em; line-height: calc(var(--line) * 2); color: var(--accent); }
.bk-day .head .md { margin-left: 2mm; line-height: var(--line); }
.bk-day .head .md .wd { color: var(--soft); margin-left: 1mm; }
.bk-day .head .energy { margin-left: auto; line-height: var(--line); white-space: nowrap; }
.bk-day .head .energy .k { font-size: 0.75em; color: var(--soft); margin-right: 1mm; }
.bk-day .row { line-height: var(--line); }
.bk-day .row .k { color: var(--accent); margin-right: 1.5mm; font-size: 0.9em; letter-spacing: 0.08em; }
.bk-day .habits span.h { white-space: nowrap; margin-right: 3mm; }
.bk-day .task-body { padding-left: 1.4em; font-size: 0.9em; color: var(--soft); }
.bk-day .part { display: flex; }
.bk-day .part .k { flex: none; }
.bk-day .part .items { flex: 1; min-width: 0; }
.bk-day .part .item { margin-right: 4mm; white-space: nowrap; }
.bk-day .empty-task { display: block; }
.bk-note { margin-top: var(--line); }
.bk-day .blank-hint { color: var(--faint); font-size: 0.85em; }

/* ---- weeks and month ends ---- */
.bk-week { page: week; break-before: page; }
.bk-week .head { height: calc(var(--line) * 2); display: flex; align-items: flex-end; gap: 3mm; }
.bk-week .head .wk { font-family: var(--latin); font-size: 2.2em; line-height: calc(var(--line) * 2); color: var(--accent); }
.bk-week .head .range { color: var(--soft); }
.bk-week .theme { margin-top: var(--line); }
.bk-week .theme .reason { color: var(--soft); font-size: 0.9em; }
.bk-monthend { page: monthend; break-before: page; }
.prompt { margin-top: var(--line); color: var(--faint); }
.prompt + .write { height: calc(var(--line) * 5); }
.short .prompt + .write { height: calc(var(--line) * 2); }

/* ---- summary ---- */
.bk-summary { page: summary; break-before: page; }
.bk-summary .letter { break-before: page; }
.bk-summary .letter .write { height: calc(var(--line) * 22); margin-top: var(--line); ${ruled} }

/* ---- notes (BlockNote documents) ---- */
.blocks > * + * { margin-top: 0; }
.blocks .h1 { font-size: 1.5em; line-height: calc(var(--line) * 2); }
.blocks .h2 { font-size: 1.25em; }
.blocks .h3 { font-size: 1.08em; color: var(--accent); }
.blocks .li { display: flex; }
.blocks .li > .mark { flex: none; min-width: 1.3em; color: var(--accent); }
.blocks .li > .body { flex: 1; min-width: 0; }
.blocks .nest { padding-left: 1.3em; }
.blocks .quote { border-left: 0.6mm solid var(--accent-soft); padding-left: 3mm; color: var(--soft); }
.blocks .callout { display: flex; gap: 2mm; background: var(--accent-wash); border-radius: 1.5mm; padding: 0 3mm; }
.blocks .callout .emoji { font-family: 'Apple Color Emoji', 'Noto Color Emoji', 'Segoe UI Emoji', sans-serif; }
.blocks .code {
  font-family: 'SF Mono', ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.78em;
  white-space: pre-wrap;
  background: var(--accent-wash);
  border-radius: 1.5mm;
  padding: 0 3mm;
  line-height: var(--line);
}
.blocks .divider { height: var(--line); display: flex; align-items: center; justify-content: center; color: var(--faint); letter-spacing: 0.6em; }
.blocks .chip { color: var(--soft); }
.blocks .chip .site { color: var(--faint); font-size: 0.85em; margin-left: 1mm; }
.blocks .columns { display: flex; gap: 5mm; }
.blocks .columns > .col { flex: 1 1 0; min-width: 0; }
.blocks table.tbl { border-collapse: collapse; width: 100%; font-size: 0.9em; }
.blocks table.tbl td, .blocks table.tbl th { border: 0.25mm solid var(--rule); padding: 0 1.5mm; vertical-align: top; text-align: left; font-weight: normal; }
.blocks table.tbl th { color: var(--accent); }
.blocks code.inline { font-family: 'SF Mono', ui-monospace, Menlo, Consolas, monospace; font-size: 0.85em; background: var(--accent-wash); padding: 0 0.8mm; border-radius: 0.8mm; }
.blocks a { color: inherit; text-decoration: underline; text-decoration-color: var(--accent-soft); }
.blocks .hl { padding: 0 0.5mm; border-radius: 0.8mm; }

/* polaroids: a white frame, a wider bottom edge, a strip of tape, a slight tilt.
   Each one is a whole number of ruled lines tall so the text below stays on them. */
.polaroids {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0 6mm;
  margin: var(--line) 0;
  break-inside: avoid;
}
.polaroid {
  position: relative;
  width: calc(var(--line) * var(--photo) * 0.86);
  height: calc(var(--line) * var(--photo));
  margin-bottom: var(--line);
  padding: 2.6mm 2.6mm 0;
  background: #fffdf8;
  box-shadow: 0 0.6mm 1.6mm rgba(40, 30, 20, 0.22), 0 0 0 0.2mm rgba(40, 30, 20, 0.08);
  transform: rotate(-1.8deg);
  break-inside: avoid;
}
.polaroid:nth-child(2n) { transform: rotate(1.4deg); }
.polaroid:nth-child(3n) { transform: rotate(-0.6deg); }
.polaroid::before {
  content: '';
  position: absolute;
  top: -2.2mm;
  left: 50%;
  width: 16mm;
  height: 5mm;
  transform: translateX(-50%) rotate(-4deg);
  background: var(--accent-soft);
  opacity: 0.55;
}
.polaroid .photo {
  width: 100%;
  height: calc(100% - var(--line) * 1.6);
  background: #ece8e0;
  overflow: hidden;
}
.polaroid img { display: block; width: 100%; height: 100%; object-fit: cover; }
.polaroid img.whole { object-fit: contain; background: #fffdf8; }
.polaroid figcaption {
  height: calc(var(--line) * 1.6);
  line-height: calc(var(--line) * 1.6);
  font-size: 0.85em;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--soft);
}
.polaroids.many .polaroid { width: calc(var(--line) * var(--photo-small) * 0.86); height: calc(var(--line) * var(--photo-small)); }

${INK_CLASSES}
`
}
