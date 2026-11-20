import { afterEach, describe, expect, it, vi } from 'vitest'
import { answerKnowledgeWithAI, invokeRagBackend, validateRagSettings } from '../src/main/rag'

describe('RAG main-process boundary', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses local search and sends cited evidence to the selected API', async () => {
    const citation = { index: 1, title: 'Document', excerpt: 'Evidence', document_id: 'doc_a', chunk_id: 'one' }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [citation], retrieval: { keyword_candidates: 1 } })))
    vi.stubGlobal('fetch', fetchMock)
    const answer = vi.fn().mockResolvedValue({ content: 'Answer [1]', model: 'cloud-model' })
    const result = await answerKnowledgeWithAI({ baseUrl: 'http://localhost:8787' }, { query: 'Question', limit: 8 }, { answer })
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8787/api/v1/knowledge/search')
    expect(answer).toHaveBeenCalledWith('Question', '[1] Document\nEvidence')
    expect(result).toMatchObject({ answer: 'Answer [1]', citations: [citation], model: 'cloud-model' })
    expect(result).not.toHaveProperty('context')
  })

  it('does not call a paid API without retrieved evidence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [], retrieval: {} }))))
    const answer = vi.fn()
    const result = await answerKnowledgeWithAI({ baseUrl: 'http://localhost:8787' }, { query: 'Question' }, { answer })
    expect(result.mode).toBe('retrieval_only')
    expect(answer).not.toHaveBeenCalled()
  })

  it('accepts only clean loopback HTTP endpoints', () => {
    expect(validateRagSettings({ baseUrl: 'http://localhost:8787/' })).toEqual({ baseUrl: 'http://localhost:8787' })
    expect(() => validateRagSettings({ baseUrl: 'https://example.com' })).toThrow('本机 HTTP 地址')
    expect(() => validateRagSettings({ baseUrl: 'http://127.0.0.1:8787/admin' })).toThrow('本机 HTTP 地址')
    expect(() => validateRagSettings({ baseUrl: 'http://user:pass@localhost:8787' })).toThrow('本机 HTTP 地址')
  })

  it('maps health to the fixed API path and rejects untrusted payload fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(invokeRagBackend({ baseUrl: 'http://127.0.0.1:8787' }, 'health', {})).resolves.toEqual({ status: 'ok' })
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8787/health')
    await expect(invokeRagBackend({ baseUrl: 'http://127.0.0.1:8787' }, 'index', {
      source_type: 'rss', source_id: 'one', title: 'Title', content: 'Body', tags: ['ok', 42]
    })).rejects.toThrow('RAG 标签无效')
  })
})
