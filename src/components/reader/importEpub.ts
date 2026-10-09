'use client'

// Adding an EPUB: read its title, author, language and cover in the browser
// (epub.js), upload the cover to `media`, then the file itself to `books`.

import { uploadMedia, uploadToCollection } from '@/lib/uploadMedia'

const EPUB_MIME = 'application/epub+zip'
const PARSE_TIMEOUT = 30_000

export type EpubMeta = { title: string; author: string | null; language: string | null; cover: Blob | null }

const withTimeout = <T,>(promise: Promise<T>, ms: number, message: string) =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms))])

/** Image type from the first bytes (EPUB archives don't always say). */
function sniffImage(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  if (String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp'
  return null
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' }

export const fileTitle = (name: string) => name.replace(/\.epub$/i, '').trim() || '未命名'

export async function readEpubMeta(file: File): Promise<EpubMeta> {
  const { default: ePub } = await import('epubjs')
  const book = ePub(await file.arrayBuffer())
  try {
    await withTimeout(book.opened, PARSE_TIMEOUT, '讀不懂這個 EPUB 檔')
    const meta = book.packaging.metadata
    let cover: Blob | null = null
    try {
      const url = await withTimeout(book.coverUrl(), 10_000, 'cover')
      if (url) {
        const blob = await (await fetch(url)).blob()
        const type = sniffImage(new Uint8Array(await blob.slice(0, 12).arrayBuffer()))
        cover = type ? new Blob([blob], { type }) : null
      }
    } catch {
      // No usable cover: the library draws one.
    }
    return {
      title: meta.title?.trim() || fileTitle(file.name),
      author: meta.creator?.trim() || null,
      language: meta.language?.trim() || null,
      cover,
    }
  } finally {
    book.destroy()
  }
}

/** Same title and author, ignoring case, spaces and punctuation. */
export const bookKey = (title: string, author: string | null) =>
  `${title}|${author ?? ''}`.toLowerCase().replace(/[\s\p{P}]+/gu, '')

/**
 * Uploads one EPUB; `onStage` reports progress for the import list. Returns
 * null (nothing uploaded) when `exists` says the library already has it.
 */
export async function importEpub(
  file: File,
  onStage: (stage: 'reading' | 'cover' | 'uploading') => void,
  exists: (key: string) => boolean,
) {
  if (!/\.epub$/i.test(file.name) && file.type !== EPUB_MIME) throw new Error('不是 EPUB 檔')
  onStage('reading')
  const meta = await readEpubMeta(file)
  if (exists(bookKey(meta.title, meta.author))) return null

  let coverUrl: string | null = null
  if (meta.cover) {
    onStage('cover')
    try {
      const ext = EXT[meta.cover.type] ?? 'jpg'
      coverUrl = await uploadMedia(new File([meta.cover], `${fileTitle(file.name)}-cover.${ext}`, { type: meta.cover.type }), {
        maxSide: 1200,
      })
    } catch {
      // The book still works without its cover.
    }
  }

  onStage('uploading')
  const epub = file.type === EPUB_MIME ? file : new File([file], file.name, { type: EPUB_MIME })
  return uploadToCollection('books', epub, { title: meta.title, author: meta.author, language: meta.language, coverUrl })
}
