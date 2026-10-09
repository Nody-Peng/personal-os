'use client'

import dynamic from 'next/dynamic'

// epub.js only runs in the browser (iframes, Blob URLs, speech).
export const ReaderLoader = dynamic(() => import('./Reader'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-canvas" />,
})
