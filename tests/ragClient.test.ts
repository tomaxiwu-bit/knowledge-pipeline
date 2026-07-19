import { beforeEach, describe, expect, it, vi } from 'vitest'
import { knowledgeClient } from '../src/renderer/services/ragClient'

describe('renderer knowledge client', () => {
  const invoke = vi.fn()

  beforeEach(() => {
    invoke.mockReset()
    Object.assign(globalThis, { window: { kpAPI: { rag: { invoke } } } })
  })

  it('uses the narrow IPC health operation', async () => {
    invoke.mockResolvedValue({ status: 'ok', storage: { documents: 1, chunks: 2 }, vectors: 2, reranker_mode: 'lexical' })

    await expect(knowledgeClient.health()).resolves.toMatchObject({ status: 'ok' })
    expect(invoke).toHaveBeenCalledWith('health')
  })

  it('preserves source metadata when indexing a renderer document', async () => {
    invoke.mockResolvedValue({ document_id: 'doc_0123456789abcdef01234567', chunk_count: 1, semantic_indexed: true })
    const document = { source_type: 'rss' as const, source_id: 'entry-1', title: 'Title', content: 'Body', tags: ['research'] }

    await knowledgeClient.index(document)

    expect(invoke).toHaveBeenCalledWith('index', document)
  })

  it('uses the API contract names for Q&A and optional debug context', async () => {
    invoke.mockResolvedValue({ answer: 'Grounded' })

    await knowledgeClient.ask('What is known?', 4, true)
    await knowledgeClient.search('evidence', 3)
    await knowledgeClient.delete('doc_0123456789abcdef01234567')

    expect(invoke).toHaveBeenNthCalledWith(1, 'ask', { query: 'What is known?', limit: 4, include_context: true })
    expect(invoke).toHaveBeenNthCalledWith(2, 'search', { query: 'evidence', limit: 3 })
    expect(invoke).toHaveBeenNthCalledWith(3, 'delete', { documentId: 'doc_0123456789abcdef01234567' })
  })
})
