// Languages offered by the code block's picker. Each id is a Shiki language
// name or alias with a grammar in `codeHighlighter.ts` ('text' has none).

export const CODE_LANGUAGES = [
  { id: 'asm', name: 'Assembly', aliases: ['assembly'] },
  { id: 'bash', name: 'Bash', aliases: ['sh', 'shell', 'zsh', 'shellscript', 'terminal', '終端機'] },
  { id: 'bat', name: 'Batch', aliases: ['cmd', 'batch'] },
  { id: 'c', name: 'C', aliases: [] },
  { id: 'cpp', name: 'C++', aliases: ['c++'] },
  { id: 'csharp', name: 'C#', aliases: ['cs', 'c#'] },
  { id: 'css', name: 'CSS', aliases: [] },
  { id: 'csv', name: 'CSV', aliases: [] },
  { id: 'dart', name: 'Dart', aliases: [] },
  { id: 'diff', name: 'Diff', aliases: ['patch'] },
  { id: 'docker', name: 'Dockerfile', aliases: ['dockerfile'] },
  { id: 'elixir', name: 'Elixir', aliases: ['ex'] },
  { id: 'go', name: 'Go', aliases: ['golang'] },
  { id: 'graphql', name: 'GraphQL', aliases: ['gql'] },
  { id: 'haskell', name: 'Haskell', aliases: ['hs'] },
  { id: 'html', name: 'HTML', aliases: [] },
  { id: 'ini', name: 'INI', aliases: [] },
  { id: 'java', name: 'Java', aliases: [] },
  { id: 'javascript', name: 'JavaScript', aliases: ['js'] },
  { id: 'json', name: 'JSON', aliases: [] },
  { id: 'jsx', name: 'JSX', aliases: [] },
  { id: 'kotlin', name: 'Kotlin', aliases: ['kt'] },
  { id: 'latex', name: 'LaTeX', aliases: ['tex'] },
  { id: 'lua', name: 'Lua', aliases: [] },
  { id: 'make', name: 'Makefile', aliases: ['makefile'] },
  { id: 'markdown', name: 'Markdown', aliases: ['md'] },
  { id: 'matlab', name: 'MATLAB', aliases: [] },
  { id: 'mermaid', name: 'Mermaid', aliases: [] },
  { id: 'nginx', name: 'Nginx', aliases: [] },
  { id: 'perl', name: 'Perl', aliases: ['pl'] },
  { id: 'php', name: 'PHP', aliases: [] },
  { id: 'powershell', name: 'PowerShell', aliases: ['ps', 'ps1', 'pwsh'] },
  { id: 'python', name: 'Python', aliases: ['py'] },
  { id: 'r', name: 'R', aliases: [] },
  { id: 'ruby', name: 'Ruby', aliases: ['rb'] },
  { id: 'rust', name: 'Rust', aliases: ['rs'] },
  { id: 'scala', name: 'Scala', aliases: [] },
  { id: 'scss', name: 'SCSS', aliases: ['sass'] },
  { id: 'sql', name: 'SQL', aliases: [] },
  { id: 'swift', name: 'Swift', aliases: [] },
  { id: 'text', name: '純文字', aliases: ['plain', 'plaintext', 'txt', 'text'] },
  { id: 'toml', name: 'TOML', aliases: [] },
  { id: 'tsx', name: 'TSX', aliases: [] },
  { id: 'typescript', name: 'TypeScript', aliases: ['ts'] },
  { id: 'vb', name: 'Visual Basic / VBA', aliases: ['vba', 'visual basic'] },
  { id: 'vue', name: 'Vue', aliases: [] },
  { id: 'xml', name: 'XML', aliases: [] },
  { id: 'yaml', name: 'YAML', aliases: ['yml'] },
  { id: 'zig', name: 'Zig', aliases: [] },
] as const

export type CodeLanguageId = (typeof CODE_LANGUAGES)[number]['id']

export const DEFAULT_CODE_LANGUAGE: CodeLanguageId = 'bash'

/** BlockNote's `supportedLanguages` shape. */
export const supportedCodeLanguages = Object.fromEntries(
  CODE_LANGUAGES.map((l) => [l.id, { name: l.name, aliases: [...l.aliases] }]),
)

/** The language id for what someone typed after ``` (empty means the default). */
export function codeLanguageFor(typed: string): string {
  const q = typed.trim().toLowerCase()
  if (!q) return DEFAULT_CODE_LANGUAGE
  const found = CODE_LANGUAGES.find((l) => l.id === q || l.name.toLowerCase() === q || l.aliases.some((a) => a === q))
  return found?.id ?? 'text'
}

export function codeLanguageName(id: string): string {
  return CODE_LANGUAGES.find((l) => l.id === id)?.name ?? (id || '純文字')
}

/** Picker search: name or alias, prefix matches first. */
export function searchCodeLanguages(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return [...CODE_LANGUAGES]
  const words = (l: (typeof CODE_LANGUAGES)[number]) => [l.id, l.name.toLowerCase(), ...l.aliases]
  const prefix = CODE_LANGUAGES.filter((l) => words(l).some((w) => w.startsWith(q)))
  const rest = CODE_LANGUAGES.filter((l) => !prefix.includes(l) && words(l).some((w) => w.includes(q)))
  return [...prefix, ...rest]
}
