// Regenerates every app icon from the mark in src/components/brand/mark.ts.
//   npx tsx scripts/generate-icons.ts
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { logoSvg } from '../src/components/brand/mark'

const png = (svg: string, size: number, out: string) =>
  sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out)

// Browser tab: SVG scales crisply; the bold variant stays legible at 16 px.
writeFileSync('src/app/icon.svg', logoSvg({ bold: true }) + '\n')

await Promise.all([
  // PWA "any" icons: the rounded tile as designed.
  png(logoSvg(), 192, 'public/icons/icon-192.png'),
  png(logoSvg(), 512, 'public/icons/icon-512.png'),
  // Maskable: full-bleed navy; Android crops to a circle or squircle, so the
  // mark stays inside the central safe zone.
  png(logoSvg({ background: 'square', scale: 0.98 }), 192, 'public/icons/icon-maskable-192.png'),
  png(logoSvg({ background: 'square', scale: 0.98 }), 512, 'public/icons/icon-maskable-512.png'),
  // iOS rounds the corners itself, so give it a square.
  png(logoSvg({ background: 'square', scale: 1.04 }), 180, 'src/app/apple-icon.png'),
])

console.log('Icons written.')
