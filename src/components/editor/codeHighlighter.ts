// Syntax highlighting for code blocks: Shiki with the JavaScript regex engine
// (no WASM), a light and a dark theme, and each grammar loaded the first time a block uses it.
// (`@shikijs/langs-precompiled` mis-tokenizes bash and python, so the regular grammars are used.)

import { SyntaxHighlightingExtension } from '@blocknote/core'
import { createBundledHighlighter, type DynamicImportLanguageRegistration } from '@shikijs/core'
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript'
import type { CodeLanguageId } from './codeLanguages'

const grammars: Record<Exclude<CodeLanguageId, 'text'>, DynamicImportLanguageRegistration> = {
  asm: () => import('@shikijs/langs/asm'),
  bash: () => import('@shikijs/langs/bash'),
  bat: () => import('@shikijs/langs/bat'),
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  csharp: () => import('@shikijs/langs/csharp'),
  css: () => import('@shikijs/langs/css'),
  csv: () => import('@shikijs/langs/csv'),
  dart: () => import('@shikijs/langs/dart'),
  diff: () => import('@shikijs/langs/diff'),
  docker: () => import('@shikijs/langs/docker'),
  elixir: () => import('@shikijs/langs/elixir'),
  go: () => import('@shikijs/langs/go'),
  graphql: () => import('@shikijs/langs/graphql'),
  haskell: () => import('@shikijs/langs/haskell'),
  html: () => import('@shikijs/langs/html'),
  ini: () => import('@shikijs/langs/ini'),
  java: () => import('@shikijs/langs/java'),
  javascript: () => import('@shikijs/langs/javascript'),
  json: () => import('@shikijs/langs/json'),
  jsx: () => import('@shikijs/langs/jsx'),
  kotlin: () => import('@shikijs/langs/kotlin'),
  latex: () => import('@shikijs/langs/latex'),
  lua: () => import('@shikijs/langs/lua'),
  make: () => import('@shikijs/langs/make'),
  markdown: () => import('@shikijs/langs/markdown'),
  matlab: () => import('@shikijs/langs/matlab'),
  mermaid: () => import('@shikijs/langs/mermaid'),
  nginx: () => import('@shikijs/langs/nginx'),
  perl: () => import('@shikijs/langs/perl'),
  php: () => import('@shikijs/langs/php'),
  powershell: () => import('@shikijs/langs/powershell'),
  python: () => import('@shikijs/langs/python'),
  r: () => import('@shikijs/langs/r'),
  ruby: () => import('@shikijs/langs/ruby'),
  rust: () => import('@shikijs/langs/rust'),
  scala: () => import('@shikijs/langs/scala'),
  scss: () => import('@shikijs/langs/scss'),
  sql: () => import('@shikijs/langs/sql'),
  swift: () => import('@shikijs/langs/swift'),
  toml: () => import('@shikijs/langs/toml'),
  tsx: () => import('@shikijs/langs/tsx'),
  typescript: () => import('@shikijs/langs/typescript'),
  vb: () => import('@shikijs/langs/vb'),
  vue: () => import('@shikijs/langs/vue'),
  xml: () => import('@shikijs/langs/xml'),
  yaml: () => import('@shikijs/langs/yaml'),
  zig: () => import('@shikijs/langs/zig'),
}

const createHighlighter = createBundledHighlighter({
  langs: grammars,
  themes: {
    'github-light': () => import('@shikijs/themes/github-light'),
    'github-dark': () => import('@shikijs/themes/github-dark'),
  },
  engine: () => createJavaScriptRegexEngine(),
})

// With a light and a dark theme loaded, BlockNote has Shiki write both colours
// as --shiki-light / --shiki-dark; styles.css picks one per page theme.
export const codeHighlighting = SyntaxHighlightingExtension({
  createHighlighter: () => createHighlighter({ themes: ['github-light', 'github-dark'], langs: [] }),
})
