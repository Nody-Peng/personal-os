import { describe, expect, it } from 'vitest'
import { safeRedirect } from '@/lib/safeRedirect'

// Pure checks, no database needed. The login page passes ?redirect= through
// safeRedirect before both the server redirect() and the client router.replace().
describe('safeRedirect', () => {
  it('keeps same-site paths, including query and hash', () => {
    for (const path of ['/', '/journal', '/journal/2026/10', '/toefl?tab=scores#latest', '/notebooks/3/12?peek=40', '/?task=5&week=2026-10-05', '/journal/day/2026-10-05#note']) {
      expect(safeRedirect(path)).toBe(path)
    }
  })

  it('rejects protocol-relative and backslash tricks', () => {
    for (const target of ['//evil.com', '//evil.com/path', '/\\evil.com', '/\\/evil.com', '\\\\evil.com', '/journal\\..\\..\\/evil.com', '/..//evil.com']) {
      expect(safeRedirect(target)).toBe('/')
    }
  })

  it('rejects control characters and whitespace that browsers strip while parsing', () => {
    for (const target of ['/\t/evil.com', '/\n/evil.com', '/\r/evil.com', '/\r\n/evil.com', '/\u0000/evil.com', '/\u007f/evil.com', ' /evil.com', '/ /evil.com', '/ /evil.com', '/ /evil.com']) {
      expect(safeRedirect(target)).toBe('/')
    }
  })

  it('rejects ?redirect=/%09/evil.com style values once decoded by the query parser', () => {
    for (const raw of ['/%09/evil.com', '/%0a/evil.com', '/%0D/evil.com', '/%5C/evil.com', '%2F%2Fevil.com']) {
      const decoded = new URLSearchParams(`redirect=${raw}`).get('redirect')
      expect(safeRedirect(decoded)).toBe('/')
    }
  })

  it('rejects absolute URLs and other schemes', () => {
    for (const target of ['https://evil.com', 'http://evil.com/', 'javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,hi', 'evil.com', 'journal']) {
      expect(safeRedirect(target)).toBe('/')
    }
  })

  it('falls back to / for empty or missing values', () => {
    expect(safeRedirect('')).toBe('/')
    expect(safeRedirect(null)).toBe('/')
    expect(safeRedirect(undefined)).toBe('/')
    // A repeated ?redirect= arrives as an array at runtime.
    expect(safeRedirect(['/a', '/b'] as unknown as string)).toBe('/')
  })

  it('never resolves to another origin', () => {
    const samples = ['/a', '/a?b=//evil.com', '/a#//evil.com', '/%2F%2Fevil.com', '/.%2E/evil.com']
    for (const target of samples) {
      const result = safeRedirect(target)
      expect(new URL(result, 'https://site.example').origin).toBe('https://site.example')
    }
  })
})
