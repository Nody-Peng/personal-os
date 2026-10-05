'use client'

import { createCodeBlockSpec, parsePreCode, parsePreCodeContent, plainContentToString } from '@blocknote/core'
import { createReactBlockSpec } from '@blocknote/react'
import { ArrowUDownLeft, CaretDown, Check, Copy, TextAa } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_CODE_LANGUAGE, codeLanguageName, searchCodeLanguages, supportedCodeLanguages } from '../codeLanguages'

// BlockNote's code block (Tab indents, Enter ×3 leaves, ``` shortcut, parsing)
// with a Notion-style bar at the top right: wrap, caption, language, copy.
const base = createCodeBlockSpec({ defaultLanguage: DEFAULT_CODE_LANGUAGE, supportedLanguages: supportedCodeLanguages })

export const CodeBlock = createReactBlockSpec(
  {
    type: 'codeBlock',
    propSchema: {
      language: { default: DEFAULT_CODE_LANGUAGE as string },
      /** Wrap long lines instead of scrolling sideways. */
      wrap: { default: false },
      /** Notion's caption under the code. */
      caption: { default: '' },
    },
    content: 'plain',
  },
  {
    // As BlockNote's own code block (Code/block.ts).
    meta: { code: true, defining: true, isolating: false, highlight: (block) => block.props.language },
    parse: (el) => parsePreCode(el),
    parseContent: (opts) => parsePreCodeContent(opts, 'codeBlock'),
    render: function CodeBlockView({ block, editor, contentRef }) {
      const { language, wrap, caption } = block.props
      const editable = editor.isEditable
      const [captioning, setCaptioning] = useState(false)
      return (
        <div className="note-code">
          <div className="note-code-bar" contentEditable={false}>
            {editable && (
              <>
                <BarButton
                  label={wrap ? '不換行' : '自動換行'}
                  active={wrap}
                  onClick={() => editor.updateBlock(block, { props: { wrap: !wrap } })}
                >
                  <ArrowUDownLeft size={13} />
                </BarButton>
                {!caption && !captioning && (
                  <BarButton label="新增說明" onClick={() => setCaptioning(true)}>
                    <TextAa size={13} />
                  </BarButton>
                )}
              </>
            )}
            <LanguagePicker value={language} disabled={!editable} onChange={(next) => editor.updateBlock(block, { props: { language: next } })} />
            <CopyButton text={() => plainContentToString(block.content)} />
          </div>
          <pre spellCheck={false} className={wrap ? 'note-code-wrap' : ''}>
            <code ref={contentRef} className={`language-${language}`} data-language={language} />
          </pre>
          {(caption || captioning) && (
            <Caption
              value={caption}
              editable={editable}
              autoFocus={captioning}
              onCommit={(next) => {
                setCaptioning(false)
                if (next !== caption) editor.updateBlock(block, { props: { caption: next } })
              }}
            />
          )}
        </div>
      )
    },
    toExternalHTML: function CodeBlockHTML({ block, contentRef }) {
      return (
        <pre>
          <code ref={contentRef} className={`language-${block.props.language}`} data-language={block.props.language} />
        </pre>
      )
    },
  },
  base.extensions,
)

function BarButton({ label, active = false, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`note-code-tool grid size-7 place-items-center rounded-md transition-colors hover:bg-black/5 hover:text-ink-strong ${active ? 'text-accent' : 'text-muted'}`}
    >
      {children}
    </button>
  )
}

/** One line under the code; saved when it loses focus or on Enter. */
function Caption({ value, editable, autoFocus, onCommit }: { value: string; editable: boolean; autoFocus: boolean; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    setShown(value)
    setDraft(value)
  }
  return (
    <div contentEditable={false} className="border-t border-line px-4 py-1.5">
      <input
        value={draft}
        readOnly={!editable}
        autoFocus={autoFocus}
        onChange={(e) => setDraft(e.target.value.slice(0, 300))}
        onBlur={() => onCommit(draft.trim())}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
        placeholder="寫一段說明…"
        aria-label="程式碼說明"
        className="w-full bg-transparent text-sm text-muted outline-none placeholder:text-faint"
      />
    </div>
  )
}

function LanguagePicker({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (language: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const results = searchCodeLanguages(query)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const show = () => {
    setQuery('')
    setActive(Math.max(0, searchCodeLanguages('').findIndex((l) => l.id === value)))
    setOpen(true)
  }
  const pick = (language: string) => {
    setOpen(false)
    if (language !== value) onChange(language)
  }

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`程式語言：${codeLanguageName(value)}`}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-black/5 hover:text-ink-strong disabled:hover:bg-transparent"
      >
        {codeLanguageName(value)}
        {!disabled && <CaretDown size={10} weight="bold" />}
      </button>
      {open && (
        <div data-own-escape className="pop-in absolute top-full right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_16px_40px_-16px_rgba(17,17,17,0.3)]">
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                const step = e.key === 'ArrowDown' ? 1 : -1
                setActive((i) => (results.length ? (i + step + results.length) % results.length : 0))
              } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                if (results[active]) pick(results[active].id)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                setOpen(false)
              }
            }}
            placeholder="搜尋語言"
            aria-label="搜尋程式語言"
            className="w-full border-b border-line bg-transparent px-3 py-2 text-sm text-ink-strong outline-none placeholder:text-faint"
          />
          <ul ref={list} role="listbox" aria-label="程式語言" className="max-h-64 overflow-y-auto p-1">
            {results.map((l, i) => (
              <li key={l.id} role="option" aria-selected={l.id === value} data-index={i}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(l.id)}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm text-ink ${i === active ? 'bg-sunken' : ''}`}
                >
                  {l.name}
                  {l.id === value && <Check size={14} className="text-accent" />}
                </button>
              </li>
            ))}
            {!results.length && <li className="px-2.5 py-2 text-sm text-faint">找不到這個語言</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

function CopyButton({ text }: { text: () => string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text()).then(() => setCopied(true))
      }}
      className="note-code-copy flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-black/5 hover:text-ink-strong"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? '已複製' : '複製'}
    </button>
  )
}
