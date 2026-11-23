/**
 * 本地虚构后端，用于生成 README 截图。
 *
 * 同时模拟 FreshRSS（Google Reader API）、Karakeep、Memos、本机 RAG 服务和
 * OpenAI 兼容的 Chat Completions 接口。所有响应来自 fixtures.cjs 中的虚构数据，
 * 不会访问任何真实服务，也不会读取本机既有资料。
 */

const http = require('node:http')
const fixtures = require('./fixtures.cjs')

function sendJson(response, status, payload) {
  const body = payload === null ? '' : JSON.stringify(payload)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body)
  })
  response.end(body)
}

function readBody(request) {
  return new Promise((resolve) => {
    let raw = ''
    request.on('data', (chunk) => { raw += chunk })
    request.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}) } catch { resolve({}) }
    })
  })
}

function freshRssItems() {
  return fixtures.rssItems.map((item) => ({
    id: item.id,
    title: item.title,
    author: item.author,
    published: Math.floor(new Date(item.publishedAt).getTime() / 1000),
    alternate: [{ href: `${fixtures.ORIGIN}/freshrss/demo/${item.id}` }],
    summary: { content: item.summary },
    content: { content: item.content },
    origin: { title: item.feedTitle },
    categories: []
  }))
}

function handleFreshRss(pathname, response) {
  if (pathname.endsWith('/subscription/list')) {
    return sendJson(response, 200, {
      subscriptions: fixtures.feeds.map((feed) => ({ id: feed.id, title: feed.title }))
    })
  }
  if (pathname.includes('/stream/contents/contents/')) {
    const raw = pathname.split('/stream/contents/contents/')[1] ?? ''
    const id = decodeURIComponent(raw)
    const item = fixtures.rssItems.find((entry) => entry.id === id)
    return sendJson(response, 200, {
      items: item ? [{ id: item.id, content: { content: item.content } }] : []
    })
  }
  if (pathname.includes('/stream/contents/')) {
    return sendJson(response, 200, { items: freshRssItems() })
  }
  return sendJson(response, 200, { ok: true })
}

function handleKarakeep(pathname, method, body, response) {
  if (method === 'POST' && pathname.endsWith('/bookmarks')) {
    return sendJson(response, 200, {
      id: 'demo-bm-new',
      url: body.url ?? '',
      title: body.title ?? body.url ?? '新收藏',
      description: '',
      tags: [],
      createdAt: new Date().toISOString()
    })
  }
  if (method === 'PATCH' && pathname.includes('/bookmarks/')) {
    return sendJson(response, 200, {})
  }
  return sendJson(response, 200, {
    bookmarks: fixtures.bookmarks.map((item) => ({ ...item, archived: false })),
    total: fixtures.bookmarks.length,
    nextCursor: null
  })
}

function handleMemos(pathname, method, body, response) {
  if (method === 'POST' && pathname.endsWith('/memo')) {
    return sendJson(response, 200, {
      name: `memo-${Date.now()}`,
      content: body.content ?? '',
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      pinned: false
    })
  }
  if (method === 'DELETE') return sendJson(response, 204, null)
  return sendJson(response, 200, {
    memos: fixtures.memos.map((item) => ({
      name: item.id,
      content: item.content,
      createTime: item.createdAt,
      updateTime: item.createdAt,
      pinned: item.pinned
    }))
  })
}

async function handleRag(pathname, method, body, response) {
  if (pathname === '/health') return sendJson(response, 200, fixtures.ragHealth)

  if (pathname === '/api/v1/knowledge/documents' && method === 'POST') {
    return sendJson(response, 200, {
      document_id: 'doc_' + '0123456789abcdef01234567',
      chunk_count: 3,
      semantic_indexed: true,
      semantic_error: null
    })
  }

  if (pathname.startsWith('/api/v1/knowledge/documents/')) {
    return sendJson(response, 204, null)
  }

  if (pathname === '/api/v1/knowledge/search') {
    return sendJson(response, 200, {
      query: body.query ?? '',
      results: fixtures.citations,
      retrieval: fixtures.retrieval
    })
  }

  if (pathname === '/api/v1/knowledge/ask') {
    return sendJson(response, 200, {
      query: body.query ?? '',
      answer: fixtures.demoAnswer,
      citations: fixtures.citations,
      mode: 'grounded_generation',
      retrieval: fixtures.retrieval,
      model: 'qwen2.5:7b-instruct'
    })
  }

  return sendJson(response, 404, { detail: 'not found' })
}

function handleAi(pathname, method, body, response) {
  if (method === 'POST' && pathname.endsWith('/chat/completions')) {
    return sendJson(response, 200, {
      id: 'demo-completion',
      object: 'chat.completion',
      model: 'qwen2.5:7b-instruct',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: fixtures.demoAnswer },
          finish_reason: 'stop'
        }
      ],
      usage: { prompt_tokens: 640, completion_tokens: 186, total_tokens: 826 }
    })
  }
  return sendJson(response, 404, { detail: 'not found' })
}

function createServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', fixtures.ORIGIN)
    const pathname = url.pathname
    const method = request.method ?? 'GET'
    const body = method === 'POST' ? await readBody(request) : {}

    try {
      if (pathname.startsWith('/freshrss/')) return handleFreshRss(pathname, response)
      if (pathname.startsWith('/karakeep/')) return handleKarakeep(pathname, method, body, response)
      if (pathname.startsWith('/memos/')) return handleMemos(pathname, method, body, response)
      if (pathname.startsWith('/ai/')) return handleAi(pathname, method, body, response)
      if (pathname === '/health' || pathname.startsWith('/api/v1/knowledge/')) {
        return handleRag(pathname, method, body, response)
      }
      return sendJson(response, 404, { detail: 'not found' })
    } catch (error) {
      return sendJson(response, 500, { detail: error instanceof Error ? error.message : 'mock error' })
    }
  })
}

function startMockServer() {
  const server = createServer()
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(fixtures.PORT, '127.0.0.1', () => resolve(server))
  })
}

module.exports = { startMockServer }

if (require.main === module) {
  startMockServer().then(() => {
    console.log(`mock backends ready on ${fixtures.ORIGIN}`)
  })
}
