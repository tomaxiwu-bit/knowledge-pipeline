export type KnowledgeSourceType = 'rss' | 'bookmark' | 'memo' | 'markdown' | 'manual'

export interface KnowledgeDocument {
  source_type: KnowledgeSourceType
  source_id: string
  title: string
  content: string
  url?: string
  tags: string[]
}

export interface KnowledgeCitation {
  index: number
  chunk_id: string
  document_id: string
  source_type: KnowledgeSourceType
  source_id: string
  title: string
  url?: string | null
  excerpt: string
  score: number
}

export interface KnowledgeAnswer {
  query: string
  answer: string
  citations: KnowledgeCitation[]
  mode: 'grounded_generation' | 'retrieval_only'
  retrieval: { keyword_candidates: number; vector_candidates: number; reranker: string }
  context?: string | null
}

export interface KnowledgeHealth {
  status: string
  storage: { documents: number; chunks: number }
  vectors: number
  reranker_mode: string
}

/** Typed renderer facade for the narrow, validated RAG IPC surface. */
export const knowledgeClient = {
  health: () => window.kpAPI.rag.invoke('health') as Promise<KnowledgeHealth>,
  index: (document: KnowledgeDocument) => window.kpAPI.rag.invoke('index', document) as Promise<{
    document_id: string
    chunk_count: number
    semantic_indexed: boolean
    semantic_error?: string | null
  }>,
  ask: (query: string, limit = 8, includeContext = false) =>
    window.kpAPI.rag.invoke('ask', { query, limit, ...(includeContext ? { include_context: true } : {}) }) as Promise<KnowledgeAnswer>,
  search: (query: string, limit = 8) => window.kpAPI.rag.invoke('search', { query, limit }),
  delete: (documentId: string) => window.kpAPI.rag.invoke('delete', { documentId })
}
