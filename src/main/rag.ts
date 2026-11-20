import type { AIClient } from '../services/types'

export interface RagSettings {
  baseUrl: string
}

export type RagBackendOperation = 'health' | 'index' | 'search' | 'ask' | 'delete'

export const DEFAULT_RAG_SETTINGS: RagSettings = {
  baseUrl: 'http://127.0.0.1:8787'
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function safeString(value: unknown, maximum: number, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error(`RAG 请求字段无效：${field}`)
  }
  return value.trim()
}

export function validateRagSettings(value: unknown): RagSettings {
  const input = asRecord(value)
  const baseUrl = safeString(input.baseUrl, 2048, 'baseUrl')
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new Error('RAG 服务地址无效')
  }

  const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])
  if (url.protocol !== 'http:' || !localHosts.has(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('RAG 服务必须是本机 HTTP 地址，例如 http://127.0.0.1:8787')
  }
  return { baseUrl: url.origin }
}

function validatePayload(operation: RagBackendOperation, payload: unknown): { method: string; path: string; body?: unknown } {
  const input = asRecord(payload)
  if (operation === 'health') return { method: 'GET', path: '/health' }

  if (operation === 'index') {
    const sourceType = safeString(input.source_type, 32, 'source_type')
    if (!['rss', 'bookmark', 'memo', 'markdown', 'manual'].includes(sourceType)) throw new Error('RAG 来源类型无效')
    const tags = Array.isArray(input.tags) ? input.tags : []
    if (tags.length > 60 || tags.some((tag) => typeof tag !== 'string' || tag.length > 120)) throw new Error('RAG 标签无效')
    const url = input.url === undefined || input.url === null ? undefined : safeString(input.url, 2048, 'url')
    return {
      method: 'POST', path: '/api/v1/knowledge/documents',
      body: {
        source_type: sourceType,
        source_id: safeString(input.source_id, 256, 'source_id'),
        title: safeString(input.title, 500, 'title'),
        content: safeString(input.content, 2_000_000, 'content'),
        ...(url ? { url } : {}),
        tags: tags.map((tag) => (tag as string).trim()).filter(Boolean)
      }
    }
  }

  if (operation === 'search' || operation === 'ask') {
    const parsedLimit = typeof input.limit === 'number' && Number.isInteger(input.limit) ? input.limit : 8
    if (parsedLimit < 1 || parsedLimit > 20) throw new Error('RAG 查询数量无效')
    return {
      method: 'POST', path: `/api/v1/knowledge/${operation === 'ask' ? 'ask' : 'search'}`,
      body: {
        query: safeString(input.query, 1000, 'query'),
        limit: parsedLimit,
        ...(operation === 'ask' && input.include_context === true ? { include_context: true } : {})
      }
    }
  }

  const documentId = safeString(input.documentId, 128, 'documentId')
  if (!/^doc_[a-f0-9]{24}$/.test(documentId)) throw new Error('RAG 文档标识无效')
  return { method: 'DELETE', path: `/api/v1/knowledge/documents/${encodeURIComponent(documentId)}` }
}

export async function invokeRagBackend(settings: RagSettings, operation: RagBackendOperation, payload: unknown): Promise<unknown> {
  const request = validatePayload(operation, payload)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), operation === 'ask' ? 90_000 : 45_000)
  try {
    const response = await fetch(`${settings.baseUrl}${request.path}`, {
      method: request.method,
      headers: request.body ? { 'content-type': 'application/json' } : undefined,
      body: request.body ? JSON.stringify(request.body) : undefined,
      signal: controller.signal
    })
    if (response.status === 204) return null
    const text = await response.text()
    let data: unknown = null
    try { data = text ? JSON.parse(text) : null } catch { data = text }
    if (!response.ok) {
      const detail = typeof data === 'object' && data && 'detail' in data ? String((data as Record<string, unknown>).detail) : text
      throw new Error(`RAG 服务返回 ${response.status}${detail ? `：${detail.slice(0, 500)}` : ''}`)
    }
    return data
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('RAG 服务请求超时，请检查本地后端和模型状态')
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
/** Keep retrieval local; send only the selected evidence excerpts to the configured API. */
export async function answerKnowledgeWithAI(settings: RagSettings, payload: unknown, client: Pick<AIClient, 'answer'>) {
  const input = asRecord(payload)
  const query = safeString(input.query, 1000, 'query')
  const search = asRecord(await invokeRagBackend(settings, 'search', input))
  if (!Array.isArray(search.results) || search.results.length > 20) throw new Error('知识检索响应格式无效')
  const citations = search.results.map((value) => {
    const citation = asRecord(value)
    if (!Number.isInteger(citation.index) || typeof citation.title !== 'string' || typeof citation.excerpt !== 'string') {
      throw new Error('知识检索引用格式无效')
    }
    return citation
  })
  const context = citations.map((citation) => `[${citation.index}] ${String(citation.title).slice(0, 500)}\n${String(citation.excerpt).slice(0, 1800)}`).join('\n\n')
  const answer = citations.length ? await client.answer(query, context) : null
  return {
    query,
    answer: answer?.content ?? '知识库中还没有可支持这个问题的材料。请先同步材料。',
    citations,
    mode: answer ? 'grounded_generation' : 'retrieval_only',
    retrieval: search.retrieval,
    model: answer?.model,
    ...(input.include_context === true ? { context } : {})
  }
}
