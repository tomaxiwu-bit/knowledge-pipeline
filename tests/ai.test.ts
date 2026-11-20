import { createServer, type Server } from 'node:http'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import '../src/services/ai'
import { createClient, getAdapterMeta } from '../src/services/registry'
import type { AIClient } from '../src/services/types'

describe('AI provider HTTP contracts', () => {
  let server: Server
  let baseUrl: string
  let status = 200
  let reply: unknown
  let requests: { url?: string; headers: Record<string, unknown>; body: Record<string, any> }[] = []
  beforeAll(async () => {
    server = createServer(async (req, res) => {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      requests.push({ url: req.url, headers: req.headers, body: JSON.parse(Buffer.concat(chunks).toString()) })
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(reply))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  })
  afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())) })
  beforeEach(() => {
    requests = []; status = 200
    reply = { choices: [{ message: { content: '摘要' }, finish_reason: 'stop' }], usage: { total_tokens: 12 } }
  })
  function client(id: string, suffix = '') {
    const ai = createClient(id) as AIClient
    ai.configure({ baseUrl: baseUrl + suffix, apiKey: 'dummy-test-key', model: 'account-model' })
    return ai
  }

  it('keeps existing Chat Completions configurations and avoids duplicate /v1', async () => {
    const result = await client('openai', '/v1/').summarize('原文')
    expect(requests[0].url).toBe('/v1/chat/completions')
    expect(requests[0].headers.authorization).toBe('Bearer dummy-test-key')
    expect(requests[0].body.messages[1].content).toContain('原文')
    expect(result.content).toBe('摘要')
  })

  it('uses Responses for Codex and reads text after reasoning output', async () => {
    reply = { status: 'completed', output: [
      { type: 'reasoning' },
      { type: 'message', content: [{ type: 'output_text', text: '基于证据 [1]' }] }
    ], usage: { total_tokens: 42 } }
    const result = await client('openai-responses').answer('问题', '[1] 证据')
    expect(requests[0].url).toBe('/v1/responses')
    expect(requests[0].body).toMatchObject({ model: 'account-model', store: false, max_output_tokens: 4096 })
    expect(requests[0].body).not.toHaveProperty('max_tokens')
    expect(requests[0].body).not.toHaveProperty('temperature')
    expect(result).toMatchObject({ content: '基于证据 [1]', tokensUsed: 42 })
  })

  it('uses Claude native authentication, system field and text blocks', async () => {
    reply = { content: [{ type: 'thinking', thinking: 'private' }, { type: 'text', text: 'Claude 摘要' }],
      stop_reason: 'end_turn', usage: { input_tokens: 4, output_tokens: 5 } }
    const result = await client('anthropic').summarize('原文')
    expect(requests[0].url).toBe('/v1/messages')
    expect(requests[0].headers['x-api-key']).toBe('dummy-test-key')
    expect(requests[0].headers['anthropic-version']).toBe('2026-10-21')
    expect(requests[0].headers).not.toHaveProperty('authorization')
    expect(requests[0].body.system).toContain('摘要')
    expect(result).toMatchObject({ content: 'Claude 摘要', tokensUsed: 9 })
  })

  it('uses the documented DeepSeek root endpoint', async () => {
    await client('deepseek').summarize('原文')
    expect(requests[0].url).toBe('/chat/completions')
    expect(getAdapterMeta('deepseek')?.configFields[0].defaultValue).toBe('https://api.deepseek.com')
  })

  it('reports invalid credentials without echoing the key', async () => {
    status = 401; reply = { error: 'dummy-test-key' }
    const result = await client('openai').testConnection()
    expect(result.success).toBe(false)
    expect(result.message).toContain('API Key')
    expect(result.message).not.toContain('dummy-test-key')
  })

  it('rejects empty and incomplete model output', async () => {
    reply = { choices: [{ message: { content: '' } }] }
    await expect(client('deepseek').summarize('原文')).rejects.toThrow('没有返回可用文本')
    reply = { status: 'incomplete', output: [] }
    await expect(client('openai-responses').summarize('原文')).rejects.toThrow('未完成输出')
    reply = { stop_reason: 'max_tokens', content: [{ type: 'text', text: 'partial' }] }
    await expect(client('anthropic').summarize('原文')).rejects.toThrow('被截断')
  })

  it('does not follow redirects carrying credentials', async () => {
    status = 302; reply = {}
    await expect(client('openai').summarize('原文')).rejects.toThrow('HTTP 302')
    expect(requests).toHaveLength(1)
  })

  it('rejects remote plaintext endpoints and credentials in URLs', () => {
    const ai = createClient('anthropic') as AIClient
    for (const address of ['http://example.com', 'https://user:secret@example.com', 'https://example.com?key=secret']) {
      expect(() => ai.configure({ baseUrl: address, apiKey: 'dummy', model: 'model' })).toThrow('API 地址')
    }
  })
})
