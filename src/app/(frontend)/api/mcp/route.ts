import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { revalidatePath } from 'next/cache'
import { ownerSession } from '@/lib/mcp/session'
import { createMcpServer } from '@/lib/mcp/tools'
import { bearerMatches } from '@/lib/secrets'

// The MCP server Claude connects to (lib/mcp/tools.ts): notebooks, the journal
// and book highlights. Streamable HTTP without sessions, so every request
// stands alone (fits serverless). Only a request carrying MCP_TOKEN as a bearer
// token gets in; without that variable the endpoint is off.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Shorter tokens are refused, so a weak one can't be set by mistake. */
const MIN_TOKEN = 32

const deny = (status: number, message: string) => Response.json({ jsonrpc: '2.0', error: { code: -32001, message }, id: null }, { status })

export async function POST(request: Request) {
  const token = process.env.MCP_TOKEN?.trim()
  if (!token || token.length < MIN_TOKEN) return deny(404, 'MCP is not enabled on this site')
  if (!bearerMatches(request.headers.get('authorization'), token)) {
    return deny(401, 'unauthorized')
  }
  const session = await ownerSession()
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
