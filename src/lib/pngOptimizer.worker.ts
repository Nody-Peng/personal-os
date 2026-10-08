// Re-compresses a PNG losslessly with oxipng (WebAssembly), off the main thread
// so typing doesn't stall while a screenshot uploads. Same pixels, smaller file.
// The single-thread build: the threaded one needs a cross-origin isolated page.

import init, { optimise } from '@jsquash/oxipng/codec/pkg/squoosh_oxipng.js'

const ready = init()

self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    await ready
    // Level 2 (oxipng's default); interlace off; transparent pixels keep their colour too.
    const out = optimise(new Uint8Array(event.data), 2, false, false)
    self.postMessage(out.buffer, { transfer: [out.buffer] })
  } catch {
    self.postMessage(null)
  }
}
