import 'server-only'
import dns from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { parseLinkMeta, type LinkMeta } from './linkMeta'
import { isPrivateAddress } from './privateAddress'

// Fetches a page's head for a bookmark card. The server must never be turned
// into a way to reach private addresses (SSRF): only http(s) on ports 80/443,
// and every address the name resolves to is checked when the connection is
// made (so DNS rebinding can't slip a private address in after a first check).

const MAX_BYTES = 1_000_000
const TIMEOUT_MS = 6000
const MAX_REDIRECTS = 4

/** dns.lookup that refuses names pointing (even partly) at private addresses. */
const publicLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, '', 4)
    const list = addresses as dns.LookupAddress[]
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) {
      return callback(Object.assign(new Error('這個網址指向內部網路，不能讀取'), { code: 'EBLOCKED' }), '', 4)
    }
    if ((options as dns.LookupOptions).all) (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list)
    else callback(null, list[0].address, list[0].family)
  })
}

function checkUrl(raw: string): URL {
  const url = new URL(raw)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('只能讀取 http(s) 網址')
  if (url.port && url.port !== '80' && url.port !== '443') throw new Error('不支援這個連接埠')
  if (url.username || url.password) throw new Error('網址不能含帳號密碼')
  // A literal IP skips DNS, so check it here.
  const hostIp = url.hostname.replace(/^\[|\]$/g, '')
  if (net.isIP(hostIp) && isPrivateAddress(hostIp)) throw new Error('這個網址指向內部網路，不能讀取')
  return url
}

type Page = { url: string; body: string }

function get(url: URL, redirects: number): Promise<Page> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http
    const req = client.request(
      url,
      {
        method: 'GET',
        lookup: publicLookup,
        timeout: TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PersonalOS-LinkPreview/1.0)',
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume()
          if (redirects >= MAX_REDIRECTS) return reject(new Error('轉址太多次'))
          try {
            resolve(get(checkUrl(new URL(res.headers.location, url).href), redirects + 1))
          } catch (error) {
            reject(error)
          }
          return
        }
        if (status >= 400) {
          res.resume()
          return reject(new Error(`網站回應 ${status}`))
        }
        const type = String(res.headers['content-type'] ?? '')
        if (type && !/html|xml/i.test(type)) {
          res.resume()
          return resolve({ url: url.href, body: '' })
        }
        const charset = type.match(/charset=([\w-]+)/i)?.[1]
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          chunks.push(chunk)
          // The head is all we need.
          if (size >= MAX_BYTES) res.destroy()
        })
        const finish = () => {
          const buffer = Buffer.concat(chunks)
          const sniffed = buffer.subarray(0, 4096).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1]
          let body: string
          try {
            body = new TextDecoder(charset ?? sniffed ?? 'utf-8').decode(buffer)
          } catch {
            body = buffer.toString('utf8')
          }
          resolve({ url: url.href, body })
        }
        res.on('end', finish)
        res.on('close', finish)
        res.on('error', reject)
      },
    )
    req.on('timeout', () => req.destroy(new Error('網站沒有回應')))
    req.on('error', reject)
    req.end()
  })
}

export async function fetchLinkMeta(raw: string): Promise<LinkMeta> {
  const page = await get(checkUrl(raw), 0)
  return parseLinkMeta(page.body, page.url)
}
