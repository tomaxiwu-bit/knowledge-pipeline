import type { RagSettings, ServiceInstance, ServiceKind } from '@/services/types'
import { normalizeInquiryThreads } from '@/lib/inquiry'

export const BACKUP_FORMAT = 'knowledge-pipeline-backup'
export const BACKUP_VERSION = 2

export interface BackupLocalData {
  relations: unknown[]
  savedSearches: unknown[]
  customTemplates: unknown[]
  inquiryThreads: unknown[]
}

/** Knowledge base document metadata included in backups (no full content). */
export interface KnowledgeBaseDocument {
  id: string
  title: string
  source_type: string
  source_id: string
  url: string | null
  tags: string[]
  created_at: string
}

/** Knowledge base section of a backup. */
export interface KnowledgeBaseBackup {
  available: boolean
  reason?: string
  documents?: KnowledgeBaseDocument[]
  exportedAt?: string
}

export interface KnowledgePipelineBackup {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  settings: {
    theme: 'light' | 'dark'
    services: ServiceInstance[]
    rag: RagSettings
  }
  local: BackupLocalData
  knowledgeBase: KnowledgeBaseBackup
}

/** RAG backend operations allowed through the IPC proxy. */
export type RagBackendOperation = 'health' | 'index' | 'search' | 'ask' | 'delete'

/** Function signature matching window.kpAPI.rag.invoke for dependency injection. */
export type RagInvoke = (operation: RagBackendOperation, payload?: unknown) => Promise<unknown>

const SECRET_KEYS = new Set(['apiKey', 'token', 'password'])
const SERVICE_KINDS = new Set<ServiceKind>(['rss', 'bookmark', 'memo', 'ai'])
const MAX_LOCAL_ITEMS = 5000
const DEFAULT_RAG: RagSettings = { baseUrl: 'http://127.0.0.1:8787' }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function isSafeServiceUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function publicRag(value: unknown): RagSettings {
  const record = asRecord(value)
  if (!record || typeof record.baseUrl !== 'string') return DEFAULT_RAG
  try {
    const url = new URL(record.baseUrl)
    const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])
    if (url.protocol === 'http:' && localHosts.has(url.hostname) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) {
      return { baseUrl: url.origin }
    }
  } catch {
    // A legacy/malformed endpoint must not make the rest of a backup unusable.
  }
  return DEFAULT_RAG
}

/** Credentials never cross the backup boundary, even when a caller supplies them. */
function toPublicService(value: unknown): ServiceInstance | null {
  const service = asRecord(value)
  if (!service) return null
  const config = asRecord(service.config)
  if (!config || !isSafeServiceUrl(config.baseUrl)) return null
  if (
    typeof service.id !== 'string' || !/^[a-zA-Z0-9_-]{3,96}$/.test(service.id) ||
    typeof service.name !== 'string' || !service.name.trim() || service.name.length > 120 ||
    typeof service.kind !== 'string' || !SERVICE_KINDS.has(service.kind as ServiceKind) ||
    typeof service.clientId !== 'string' || !/^[a-zA-Z0-9_-]{2,96}$/.test(service.clientId)
  ) return null

  const publicConfig: Record<string, string> = { baseUrl: config.baseUrl.trim() }
  if (service.kind === 'ai') {
    if (typeof config.model !== 'string' || !config.model.trim() || config.model.length > 256) return null
    publicConfig.model = config.model.trim()
  }

  // The loop documents the boundary and protects future config expansion.
  for (const key of SECRET_KEYS) delete publicConfig[key]

  return {
    id: service.id,
    name: service.name.trim(),
    kind: service.kind as ServiceKind,
    clientId: service.clientId,
    config: publicConfig as unknown as ServiceInstance['config']
  }
}

function checkedArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`备份中的 ${label} 格式无效`)
  if (value.length > MAX_LOCAL_ITEMS) throw new Error(`备份中的 ${label} 项目过多`)
  return value
}

function publicServices(services: unknown): ServiceInstance[] {
  if (!Array.isArray(services) || services.length > 50) throw new Error('备份中的服务配置格式无效')
  const output = services.map(toPublicService)
  if (output.some((service) => !service)) throw new Error('备份中存在无效的服务配置')
  return output as ServiceInstance[]
}

function safeStringField(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Fetches knowledge base document metadata via the RAG search endpoint.
 *
 * Calls the RAG service's /api/v1/knowledge/search endpoint with an empty
 * query and a high limit to retrieve the full document list. Only document
 * metadata (id/title/source_type/source_id/url/tags/created_at) is collected;
 * full content is excluded to keep backup files small.
 *
 * If the RAG service is unavailable or rejects the request, the backup
 * continues with knowledgeBase marked as unavailable.
 */
export async function fetchKnowledgeBaseForBackup(invoke: RagInvoke): Promise<KnowledgeBaseBackup> {
  try {
    const result = await invoke('search', { query: '', limit: 10000 })
    const response = asRecord(result)
    const rawResults = Array.isArray(response?.results) ? response.results : []

    const documents: KnowledgeBaseDocument[] = []
    const seen = new Set<string>()
    for (const item of rawResults) {
      const record = asRecord(item)
      if (!record) continue
      const id = safeStringField(record.document_id)
      if (!id || seen.has(id)) continue
      seen.add(id)
      documents.push({
        id,
        title: safeStringField(record.title),
        source_type: safeStringField(record.source_type),
        source_id: safeStringField(record.source_id),
        url: typeof record.url === 'string' ? record.url : null,
        tags: Array.isArray(record.tags) ? record.tags.filter((t): t is string => typeof t === 'string') : [],
        created_at: safeStringField(record.created_at),
      })
    }
    return { available: true, documents, exportedAt: new Date().toISOString() }
  } catch {
    return { available: false, reason: 'RAG服务不可用' }
  }
}

/** Parses the knowledgeBase field from a v2 backup, with lenient validation. */
function parseKnowledgeBaseField(value: unknown): KnowledgeBaseBackup {
  const record = asRecord(value)
  if (!record || record.available !== true) {
    return {
      available: false,
      reason: typeof record?.reason === 'string' ? record.reason : '知识库数据不可用',
    }
  }
  const rawDocuments = Array.isArray(record.documents) ? record.documents : []
  const documents: KnowledgeBaseDocument[] = []
  for (const item of rawDocuments) {
    const doc = asRecord(item)
    if (!doc || typeof doc.id !== 'string') continue
    documents.push({
      id: doc.id,
      title: safeStringField(doc.title),
      source_type: safeStringField(doc.source_type),
      source_id: safeStringField(doc.source_id),
      url: typeof doc.url === 'string' ? doc.url : null,
      tags: Array.isArray(doc.tags) ? doc.tags.filter((t): t is string => typeof t === 'string') : [],
      created_at: safeStringField(doc.created_at),
    })
  }
  return {
    available: true,
    documents,
    exportedAt: typeof record.exportedAt === 'string' ? record.exportedAt : new Date().toISOString(),
  }
}

export function createBackup(input: {
  theme: 'light' | 'dark'
  services: unknown
  rag?: unknown
  local: BackupLocalData
  knowledgeBase?: KnowledgeBaseBackup
}): KnowledgePipelineBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: {
      theme: input.theme,
      services: publicServices(input.services),
      rag: publicRag(input.rag)
    },
    local: {
      relations: checkedArray(input.local.relations, '关系'),
      savedSearches: checkedArray(input.local.savedSearches, '智能集合'),
      customTemplates: checkedArray(input.local.customTemplates, '自定义模板'),
      inquiryThreads: normalizeInquiryThreads(checkedArray(input.local.inquiryThreads, '探究线'))
    },
    knowledgeBase: input.knowledgeBase ?? { available: false, reason: '未提供知识库数据' }
  }
}

export function parseBackup(value: unknown): KnowledgePipelineBackup {
  const backup = asRecord(value)
  if (!backup || backup.format !== BACKUP_FORMAT) {
    throw new Error('不是受支持的知识流水线备份文件')
  }
  const version = backup.version
  // Accept both v1 (no knowledgeBase field) and v2 (with knowledgeBase).
  if (version !== 1 && version !== 2) {
    throw new Error('不是受支持的知识流水线备份文件')
  }
  const settings = asRecord(backup.settings)
  const local = asRecord(backup.local)
  if (!settings || !local || (settings.theme !== 'light' && settings.theme !== 'dark')) {
    throw new Error('备份缺少必要的设置')
  }

  // v1 backups predate the knowledgeBase field; mark as unavailable.
  const knowledgeBase = version === 1
    ? { available: false as const, reason: '旧版备份不包含知识库数据' }
    : parseKnowledgeBaseField(backup.knowledgeBase)

  return createBackup({
    theme: settings.theme,
    services: settings.services,
    rag: settings.rag,
    local: {
      relations: checkedArray(local.relations, '关系'),
      savedSearches: checkedArray(local.savedSearches, '智能集合'),
      customTemplates: checkedArray(local.customTemplates, '自定义模板'),
      inquiryThreads: checkedArray(local.inquiryThreads, '探究线')
    },
    knowledgeBase
  })
}
