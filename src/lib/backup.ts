import type { ServiceInstance, ServiceKind } from '@/services/types'
import { normalizeInquiryThreads } from '@/lib/inquiry'

export const BACKUP_FORMAT = 'knowledge-pipeline-backup'
export const BACKUP_VERSION = 1

export interface BackupLocalData {
  relations: unknown[]
  savedSearches: unknown[]
  customTemplates: unknown[]
  inquiryThreads: unknown[]
}

export interface KnowledgePipelineBackup {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  settings: {
    theme: 'light' | 'dark'
    services: ServiceInstance[]
  }
  local: BackupLocalData
}

const SECRET_KEYS = new Set(['apiKey', 'token', 'password'])
const SERVICE_KINDS = new Set<ServiceKind>(['rss', 'bookmark', 'memo', 'ai'])
const MAX_LOCAL_ITEMS = 5000

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

export function createBackup(input: {
  theme: 'light' | 'dark'
  services: unknown
  local: BackupLocalData
}): KnowledgePipelineBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: {
      theme: input.theme,
      services: publicServices(input.services)
    },
    local: {
      relations: checkedArray(input.local.relations, '关系'),
      savedSearches: checkedArray(input.local.savedSearches, '智能集合'),
      customTemplates: checkedArray(input.local.customTemplates, '自定义模板'),
      inquiryThreads: normalizeInquiryThreads(checkedArray(input.local.inquiryThreads, '探究线'))
    }
  }
}

export function parseBackup(value: unknown): KnowledgePipelineBackup {
  const backup = asRecord(value)
  if (!backup || backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION) {
    throw new Error('不是受支持的知识流水线备份文件')
  }
  const settings = asRecord(backup.settings)
  const local = asRecord(backup.local)
  if (!settings || !local || (settings.theme !== 'light' && settings.theme !== 'dark')) {
    throw new Error('备份缺少必要的设置')
  }

  return createBackup({
    theme: settings.theme,
    services: settings.services,
    local: {
      relations: checkedArray(local.relations, '关系'),
      savedSearches: checkedArray(local.savedSearches, '智能集合'),
      customTemplates: checkedArray(local.customTemplates, '自定义模板'),
      inquiryThreads: checkedArray(local.inquiryThreads, '探究线')
    }
  })
}
