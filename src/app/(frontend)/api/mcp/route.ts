import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import { ownerSession } from '@/lib/mcp/session'
import { createMcpServer } from '@/lib/mcp/tools'
import { sessionForBearer } from '@/lib/mcpKeys'
import { bearerMatches } from '@/lib/secrets'
import type { Session } from '@/lib/session'

// The MCP server Claude connects to (lib/mcp/tools.ts): notebooks, the journal
// and book highlights. Streamable HTTP without sessions, so every request
// stands alone (fits serverless). A request gets in with a bearer token: a key
// issued on /studio (acting as the account that made it), or MCP_TOKEN when
// that variable is set (acting as the owner, lib/mcp/session.ts).
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Shorter tokens are refused, so a weak one can't be set by mistake. */
const MIN_TOKEN = 32

const deny = (status: number, message: string) => Response.json({ jsonrpc: '2.0', error: { code: -32001, message }, id: null }, { status })

async function authenticate(header: string | null): Promise<Session | null> {
  const token = process.env.MCP_TOKEN?.trim()
  if (token && token.length >= MIN_TOKEN && bearerMatches(header, token)) return ownerSession()
  return sessionForBearer(await getPayload({ config }), header)
}

export async function POST(request: Request) {
  const session = await authenticate(request.headers.get('authorization'))
  if (!session) return deny(401, 'unauthorized')
  const server = createMcpServer({ session, origin: new URL(request.url).origin, revalidate: (path, type) => revalidatePath(path, type) })
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  try {
    return await transport.handleRequest(request)
  } finally {
    // Stateless: nothing to keep once this request is answered.
    void server.close()
  }
}

/** No server-sent stream or session to end without sessions. */
const notAllowed = () => new Response(null, { status: 405, headers: { Allow: 'POST' } })
export const GET = notAllowed
export const DELETE = notAllowed
