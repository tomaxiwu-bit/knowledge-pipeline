// Karakeep (原 Hoarder) API 适配器
// 文档: https://docs.karakeep.app/API/
// 使用 Bearer token 认证

import axios, { AxiosInstance } from 'axios'
import type { Bookmark, ServiceConfig, ConnectionResult, BookmarkClient } from './types'
import { registerAdapter } from './registry'

export class KarakeepClient implements BookmarkClient {
  private client: AxiosInstance | null = null
  private config: ServiceConfig | null = null

  configure(config: ServiceConfig) {
    this.config = config
    const baseUrl = config.baseUrl.replace(/\/$/, '')
    this.client = axios.create({
      baseURL: `${baseUrl}/api/v1`,
      timeout: 15000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    })
  }

  isConfigured(): boolean {
    return !!(this.config?.baseUrl && this.config?.apiKey)
  }

  async testConnection(): Promise<ConnectionResult> {
    if (!this.isConfigured() || !this.client) {
      return { success: false, message: '未配置 Karakeep 地址或 API Key' }
    }
    try {
      const resp = await this.client.get('/bookmarks?pageSize=1')
      return { success: true, message: `连接成功，共 ${resp.data?.total ?? 0} 条收藏` }
    } catch (err: any) {
      const msg = err.response?.status === 401 ? 'API Key 无效' : `连接失败: ${err.message}`
      return { success: false, message: msg }
    }
  }

  async getBookmarks(limit = 50): Promise<Bookmark[]> {
    if (!this.client) return []
    try {
      const resp = await this.client.get(`/bookmarks?pageSize=${limit}`)
      const items = resp.data?.bookmarks ?? []
      return items.map((item: any): Bookmark => ({
        id: item.id ?? '',
        title: item.title ?? item.url ?? '无标题',
        url: item.url ?? '',
        description: item.description,
        content: item.content ?? item.htmlContent,
        coverImage: item.coverImage,
        tags: item.tags ?? [],
        createdAt: item.createdAt ?? new Date().toISOString(),
        archived: item.archived ?? false,
        // Karakeep 不区分来源，统一标记为 external；RSS 文章收藏时会显式传 entryId
        sourceType: item.entryId ? 'rss' : 'external',
        entryId: item.entryId,
        readLaterUntil: item.readLaterUntil ?? null
      }))
    } catch (error) {
      throw new Error(`无法加载 Karakeep 收藏: ${getErrorMessage(error)}`)
    }
  }

  async createBookmark(url: string, title?: string, options?: { entryId?: string; readLaterUntil?: string }): Promise<Bookmark | null> {
    if (!this.client) return null
    try {
      const payload: any = {
        url,
        title: title ?? null,
        type: 'link'
      }
      // 双来源支持：RSS 文章收藏时带 entryId
      if (options?.entryId) {
        payload.entryId = options.entryId
      }
      // 稍后阅读过期时间
      if (options?.readLaterUntil) {
        payload.readLaterUntil = options.readLaterUntil
      }
      const resp = await this.client.post('/bookmarks', payload)
      const item = resp.data
      return {
        id: item.id,
        title: item.title ?? url,
        url: item.url ?? url,
        description: item.description,
        tags: item.tags ?? [],
        createdAt: item.createdAt ?? new Date().toISOString(),
        archived: false,
        sourceType: options?.entryId ? 'rss' : 'external',
        entryId: options?.entryId,
        readLaterUntil: options?.readLaterUntil ?? null
      }
    } catch {
      return null
    }
  }

  async archiveBookmark(id: string): Promise<void> {
    if (!this.client) return
    try {
      await this.client.patch(`/bookmarks/${id}`, { archived: true })
    } catch {}
  }
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return '网络或服务错误'
}

export const karakeepClient = new KarakeepClient()

registerAdapter(
  {
    id: 'karakeep',
    kind: 'bookmark',
    displayName: 'Karakeep',
    description: '链接收藏与稍后阅读，AI 自动打标签',
    configFields: [
      { key: 'baseUrl', label: '服务地址', type: 'url', placeholder: 'https://your-karakeep.example.com', required: true },
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '在 Karakeep 设置 → API 中生成', required: true }
    ]
  },
  () => new KarakeepClient()
)
