// 适配器注册表
// 每个适配器自注册，新增后端只需在 registry.ts 里 register 一次，不用动其他代码

import type {
  AdapterMeta,
  ServiceKind,
  RSSClient,
  BookmarkClient,
  MemoClient,
  AIClient
} from './types'

// 工厂函数类型：返回一个新的客户端实例
export type ClientFactory =
  | (() => RSSClient)
  | (() => BookmarkClient)
  | (() => MemoClient)
  | (() => AIClient)

interface AdapterEntry {
  meta: AdapterMeta
  factory: ClientFactory
}

// 全局注册表
const registry = new Map<string, AdapterEntry>()

/** 注册一个适配器 */
export function registerAdapter(meta: AdapterMeta, factory: ClientFactory): void {
  registry.set(meta.id, { meta, factory })
}

/** 获取适配器元信息 */
export function getAdapterMeta(id: string): AdapterMeta | undefined {
  return registry.get(id)?.meta
}

/** 创建一个客户端实例 */
export function createClient(id: string): RSSClient | BookmarkClient | MemoClient | AIClient | null {
  const entry = registry.get(id)
  if (!entry) return null
  return entry.factory()
}

/** 列出某个环节所有已注册的适配器 */
export function listAdapters(kind: ServiceKind): AdapterMeta[] {
  const result: AdapterMeta[] = []
  for (const entry of registry.values()) {
    if (entry.meta.kind === kind) result.push(entry.meta)
  }
  return result
}

/** 列出所有适配器，按环节分组 */
export function listAllAdapters(): Record<ServiceKind, AdapterMeta[]> {
  const result: Record<ServiceKind, AdapterMeta[]> = {
    rss: [],
    bookmark: [],
    memo: [],
    ai: []
  }
  for (const entry of registry.values()) {
    result[entry.meta.kind].push(entry.meta)
  }
  return result
}

/** 环节显示名（给 UI 用） */
export const KIND_LABELS: Record<ServiceKind, string> = {
  rss: 'RSS 发现',
  bookmark: '链接收藏',
  memo: '速记笔记',
  ai: 'AI 摘要'
}

/** 环节图标（给 UI 用） */
export const KIND_ICONS: Record<ServiceKind, string> = {
  rss: '📰',
  bookmark: '🔖',
  memo: '📝',
  ai: '🤖'
}
