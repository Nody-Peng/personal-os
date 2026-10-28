import 'server-only'
import sharp from 'sharp'
import type { Session } from './session'
import { storageName } from './storageName'

// Images Claude puts on pages through the MCP endpoint. They arrive as base64,
// are scaled and re-encoded as a compressed JPEG here (the browser does the
// same in lib/uploadMedia.ts before it uploads), and are stored in `media`
// like any other upload, so the page refers to them by /api/media/file/<name>.

/** Vercel refuses request bodies over 4.5 MB, and base64 adds a third. */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024
export const DEFAULT_IMAGE_SIDE = 1920
export const DEFAULT_IMAGE_QUALITY = 80

export type ImageInput = {
  /** Base64, with or without a data: URL prefix. */
  data: string
  filename: string
  alt?: string
  /** Longest side in px; smaller images are never enlarged. */
  maxSide?: number
  /** JPEG quality, 1–100. */
  quality?: number
}

export type StoredImage = { id: number; url: string; width: number; height: number; bytes: number }

export async function storeImage({ payload, user }: Session, input: ImageInput): Promise<StoredImage> {
  const original = Buffer.from(input.data.replace(/^data:[^,]*,/, ''), 'base64')
  if (!original.length) throw new Error('圖片是空的')
  if (original.length > MAX_IMAGE_BYTES) throw new Error('圖片超過 3 MB，請先縮小再上傳')
  const side = input.maxSide ?? DEFAULT_IMAGE_SIDE
  let encoded: { data: Buffer; info: { width: number; height: number } }
  try {
    encoded = await sharp(original)
      .rotate()
      .resize({ width: side, height: side, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      // 4:4:4 keeps small coloured text (slides, screenshots) from smearing.
      .jpeg({ quality: input.quality ?? DEFAULT_IMAGE_QUALITY, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer({ resolveWithObject: true })
  } catch {
    throw new Error('看不懂這張圖片：請傳 JPEG、PNG 或 WebP')
  }
  const name = storageName(`${input.filename.replace(/\.[^.]*$/, '')}.jpg`, 'image')
  const doc = await payload.create({
    collection: 'media',
    data: { alt: input.alt ?? '' },
    file: { data: encoded.data, mimetype: 'image/jpeg', name, size: encoded.data.length },
    user,
    overrideAccess: false,
  })
  if (!doc.url) throw new Error('上傳成功但沒有拿到圖片網址')
  return { id: doc.id, url: doc.url, width: encoded.info.width, height: encoded.info.height, bytes: encoded.data.length }
}
