'use client'

// Uploads a file to the `media` collection and returns its URL
// (/api/media/file/<name>, served behind the login check).
//   s3    → ask Payload for a signed URL, PUT straight to Supabase Storage,
//           then create the media doc (no Vercel body-size limit)
//   local → plain multipart POST to Payload (development, files in ./media)

import { getUploadMode } from '@/app/(frontend)/notebook-actions'

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

async function errorOf(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return body?.errors?.[0]?.message ?? `上傳失敗（${res.status}）`
  } catch {
    return `上傳失敗（${res.status}）`
  }
}

async function postMultipart(form: FormData): Promise<string> {
  const res = await fetch('/api/media', { method: 'POST', body: form, credentials: 'include' })
  if (!res.ok) throw new Error(await errorOf(res))
  const { doc } = await res.json()
  return doc.url as string
}

export async function uploadMedia(original: File, options?: ShrinkOptions): Promise<string> {
  const current = await uploadMode()
  if (current === 'off') throw new Error('還沒設定檔案儲存空間（Supabase Storage），暫時不能上傳')
  const file = await shrinkImage(original, options)
  if (file.size > MAX_BYTES) throw new Error('檔案超過 50 MB')

  if (current === 'local') {
    const form = new FormData()
    form.append('file', file)
    form.append('_payload', JSON.stringify({}))
    return postMultipart(form)
  }

  const signed = await fetch('/api/storage-s3-generate-signed-url', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collectionSlug: 'media', filename: file.name, filesize: file.size, mimeType: file.type }),
  })
  if (!signed.ok) throw new Error(await errorOf(signed))
  const { clientUploadContext, filename, headers, url } = await signed.json()
  const put = await fetch(url, { method: 'PUT', body: file, headers })
  if (!put.ok) throw new Error(`上傳到儲存空間失敗（${put.status}）`)

  const form = new FormData()
  form.append(
    'file',
    JSON.stringify({ clientUploadContext, collectionSlug: 'media', filename: filename ?? file.name, mimeType: file.type, size: file.size }),
  )
  form.append('_payload', JSON.stringify({}))
  return postMultipart(form)
}

/** Shows an error in the notebook's toast (NotebookShell listens). */
export function reportNoteError(message: string) {
  window.dispatchEvent(new CustomEvent('notes:error', { detail: message }))
}
