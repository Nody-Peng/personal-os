'use client'

// Uploads a file to the `media` collection and returns its URL
// (/api/media/file/<name>, served behind the login check). `uploadToCollection`
// does the same for any upload collection (e-books go to `books`).
//   s3    → ask Payload for a signed URL, PUT straight to Supabase Storage,
//           then create the doc (no Vercel body-size limit)
//   local → plain multipart POST to Payload (development, files in ./media)

import { getUploadMode } from '@/app/(frontend)/notebook-actions'
import { storageName } from './storageName'

const MAX_SIDE = 2400
const MAX_BYTES = 50 * 1024 * 1024
const RESIZABLE = /^image\/(jpeg|png|webp|heic|heif|avif)$/

let mode: Promise<'s3' | 'local' | 'off'> | null = null
const uploadMode = () =>
  (mode ??= getUploadMode().then((r) => {
    if (!r.ok) {
      mode = null
      throw new Error(r.error)
    }
    return r.data!
  }))

/** Photos from a phone are huge: scale to ≤ 2400px and re-encode before upload. */
type ShrinkOptions = {
  /** Longest side in px (photos 2400; page icons 512). */
  maxSide?: number
  /** Keep transparency: anything but a JPEG becomes PNG (page icons). */
  keepAlpha?: boolean
}

async function shrinkImage(file: File, { maxSide = MAX_SIDE, keepAlpha = false }: ShrinkOptions = {}): Promise<File> {
  if (!RESIZABLE.test(file.type) || typeof createImageBitmap !== 'function') return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  // WebP always goes (see below), however small.
  const mustConvert = file.type === 'image/webp'
  if (scale === 1 && file.size < 1_500_000 && !mustConvert) {
    bitmap.close()
    return file
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  // JPEG, not WebP: Payload treats WebP as possibly animated and re-encodes it,
  // which would leave the directly uploaded original orphaned in the bucket.
  const type = file.type === 'image/png' || (keepAlpha && file.type !== 'image/jpeg') ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85))
  if (!blob || (blob.size >= file.size && !mustConvert)) return file
  const ext = blob.type === 'image/png' ? 'png' : 'jpg'
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + `.${ext}`, { type: blob.type })
}

/**
 * Screenshots (PNG) keep every pixel: oxipng re-compresses them losslessly in a
 * worker (often a third smaller). Anything else, or any failure, passes through.
 */
async function optimisePng(file: File): Promise<File> {
  if (file.type !== 'image/png' || typeof Worker === 'undefined') return file
  let worker: Worker | null = null
  try {
    worker = new Worker(new URL('./pngOptimizer.worker.ts', import.meta.url), { type: 'module' })
    const input = await file.arrayBuffer()
    const output = await new Promise<ArrayBuffer | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 30_000)
      worker!.onmessage = (event: MessageEvent<ArrayBuffer | null>) => {
        clearTimeout(timer)
        resolve(event.data)
      }
      worker!.onerror = () => {
        clearTimeout(timer)
        resolve(null)
      }
      worker!.postMessage(input, [input])
    })
    return output && output.byteLength < file.size ? new File([output], file.name, { type: 'image/png' }) : file
  } catch {
    return file
  } finally {
    worker?.terminate()
  }
}

async function errorOf(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return body?.errors?.[0]?.message ?? `上傳失敗（${res.status}）`
  } catch {
    return `上傳失敗（${res.status}）`
  }
}

type UploadCollection = 'media' | 'books'
type UploadedDoc = { id: number; url: string }

async function postMultipart(collection: UploadCollection, form: FormData): Promise<UploadedDoc> {
  const res = await fetch(`/api/${collection}`, { method: 'POST', body: form, credentials: 'include' })
  if (!res.ok) throw new Error(await errorOf(res))
  const { doc } = await res.json()
  return { id: doc.id as number, url: doc.url as string }
}

/** S3 errors come back as XML: <Error><Code>…</Code><Message>…</Message></Error>. */
async function storageError(res: Response): Promise<string> {
  let detail = ''
  try {
    const text = await res.text()
    detail = text.match(/<Message>([^<]*)<\/Message>/)?.[1] ?? text.match(/"message"\s*:\s*"([^"]*)"/)?.[1] ?? ''
  } catch {
    // No body.
  }
  return `上傳到儲存空間失敗（${res.status}${detail ? `：${detail.slice(0, 120)}` : ''}）`
}

/** Creates a doc in an upload collection with `file` and the given fields. */
export async function uploadToCollection(
  collection: UploadCollection,
  original: File,
  data: Record<string, unknown> = {},
): Promise<UploadedDoc> {
  const current = await uploadMode()
  if (current === 'off') throw new Error('還沒設定檔案儲存空間（Supabase Storage），暫時不能上傳')
  if (original.size > MAX_BYTES) throw new Error('檔案超過 50 MB')
  const name = storageName(original.name, collection === 'books' ? 'book' : 'file')
  const file = name === original.name ? original : new File([original], name, { type: original.type })

  if (current === 'local') {
    const form = new FormData()
    form.append('file', file)
    form.append('_payload', JSON.stringify(data))
    return postMultipart(collection, form)
  }

  const signed = await fetch('/api/storage-s3-generate-signed-url', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collectionSlug: collection, filename: file.name, filesize: file.size, mimeType: file.type }),
  })
  if (!signed.ok) throw new Error(await errorOf(signed))
  const { clientUploadContext, filename, headers, url } = await signed.json()
  const put = await fetch(url, { method: 'PUT', body: file, headers })
  if (!put.ok) throw new Error(await storageError(put))

  const form = new FormData()
  form.append(
    'file',
    JSON.stringify({ clientUploadContext, collectionSlug: collection, filename: filename ?? file.name, mimeType: file.type, size: file.size }),
  )
  form.append('_payload', JSON.stringify(data))
  return postMultipart(collection, form)
}

export async function uploadMedia(original: File, options?: ShrinkOptions): Promise<string> {
  // Photos are scaled and re-encoded; screenshots keep their size and are only
  // compressed losslessly (page icons are scaled first, then compressed too).
  const scaled = original.type === 'image/png' && !options?.maxSide ? original : await shrinkImage(original, options)
  const file = await optimisePng(scaled)
  return (await uploadToCollection('media', file)).url
}

/** Shows an error in the notebook's toast (NotebookShell listens). */
export function reportNoteError(message: string) {
  window.dispatchEvent(new CustomEvent('notes:error', { detail: message }))
}
