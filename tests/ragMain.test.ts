import { afterEach, describe, expect, it, vi } from 'vitest'
import { invokeRagBackend, validateRagSettings } from '../src/main/rag'

describe('RAG main-process boundary', () => {
  afterEach(() => vi.unstubAllGlobals())

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
