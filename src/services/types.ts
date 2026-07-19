// API 适配层 - 可扩展的类型系统

// ============ 数据模型（跨后端通用） ============

/** RSS 订阅源中的单篇文章 */
export interface RSSItem {
  id: string
  title: string
  url: string
  author?: string
  summary: string
  content?: string
  publishedAt: string
  feedTitle?: string
  read: boolean
  starred: boolean
}

/** 收藏的链接 */
export interface Bookmark {
  id: string
  title: string
  url: string
  description?: string
  content?: string
  coverImage?: string
  tags: string[]
  createdAt: string
  archived: boolean
  /** 来源类型：rss 表示来自 RSS 文章，external 表示外部 URL */
  sourceType?: 'rss' | 'external'
  /** 若来自 RSS 文章，关联的 Entry ID */
  entryId?: string
  /** 稍后阅读的过期时间（可选），过期后自动清理 */
  readLaterUntil?: string | null
}

/** 速记笔记 */
export interface Memo {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  tags: string[]
  pinned: boolean
}

/** AI 摘要结果 */
export interface AISummary {
  content: string
  model: string
  createdAt: string
  tokensUsed?: number
}

// ============ 后端分类 ============

/** 流水线环节类型——扩展新环节时在此添加 */
export type ServiceKind = 'rss' | 'bookmark' | 'memo' | 'ai'

/** 各环节的客户端接口契约 */
export interface RSSClient {
  configure(config: ServiceConfig): void
  isConfigured(): boolean
  testConnection(): Promise<ConnectionResult>
  getUnreadItems(limit?: number): Promise<RSSItem[]>
  getItemContent(itemId: string): Promise<string>
  markAsRead(itemId: string): Promise<void>
  starItem(itemId: string): Promise<void>
}

export interface BookmarkClient {
  configure(config: ServiceConfig): void
  isConfigured(): boolean
  testConnection(): Promise<ConnectionResult>
  getBookmarks(limit?: number): Promise<Bookmark[]>
  createBookmark(url: string, title?: string, options?: { entryId?: string; readLaterUntil?: string }): Promise<Bookmark | null>
  archiveBookmark(id: string): Promise<void>
}

export interface MemoClient {
  configure(config: ServiceConfig): void
  isConfigured(): boolean
  testConnection(): Promise<ConnectionResult>
  getMemos(limit?: number): Promise<Memo[]>
  createMemo(content: string): Promise<Memo | null>
  deleteMemo(id: string): Promise<void>
}

export interface AIClient {
  configure(config: AIConfig): void
  isConfigured(): boolean
  testConnection(): Promise<ConnectionResult>
  summarize(text: string, options?: AISummaryOptions): Promise<AISummary>
}

// ============ 配置类型 ============

/** 通用后端配置 */
export interface ServiceConfig {
  baseUrl: string
  apiKey: string
}

/** AI 后端配置 */
export interface AIConfig {
  baseUrl: string
  apiKey: string
  model: string
}

/** 后端实例配置（用户在设置页添加的每一个后端） */
export interface ServiceInstance {
  id: string           // 实例唯一 ID（UUID）
  name: string         // 用户起的名字，如「我的 FreshRSS」
  kind: ServiceKind    // 环节类型
  clientId: string     // 适配器 ID，如 'freshrss'、'miniflux'
  config: ServiceConfig | AIConfig
  /** 仅供渲染进程判断是否已在主进程中完成凭据配置；不包含凭据本身。 */
  configured?: boolean
}

/** AI 摘要选项 */
export interface AISummaryOptions {
  maxLength?: number
  style?: 'concise' | 'detailed' | 'bullets'
  language?: string
}

/** 所有设置——可扩展结构 */
export interface AllSettings {
  theme: 'light' | 'dark'
  services: ServiceInstance[]
  rag: RagSettings
}

/** Local API endpoint for the full-text and RAG service. */
export interface RagSettings {
  baseUrl: string
}

/** 兼容旧版（迁移用） */
export interface LegacyAllSettings {
  freshrss?: ServiceConfig
  karakeep?: ServiceConfig
  memos?: { baseUrl: string; token: string }
  theme?: 'light' | 'dark'
}

// ============ 通用结果类型 ============

/** 连接测试结果 */
export interface ConnectionResult {
  success: boolean
  message: string
}

/** 服务连接状态 */
export type ServiceStatus = 'idle' | 'connected' | 'error' | 'unconfigured'

/** 适配器元信息（注册表用） */
export interface AdapterMeta {
  id: string                 // 适配器 ID，如 'freshrss'
  kind: ServiceKind          // 属于哪个环节
  displayName: string        // 设置页显示名，如「FreshRSS」
  description: string        // 一句话描述
  configFields: ConfigField[] // 配置表单字段
}

/** 配置表单字段定义 */
export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'password' | 'url'
  placeholder?: string
  help?: string
  required: boolean
}
