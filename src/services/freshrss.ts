// FreshRSS API 适配器
// FreshRSS 兼容 Google Reader API，使用 API key 认证
// 文档: https://freshrss.github.io/FreshRSS/en/developers/03_Google_Reader_API.html

import axios, { AxiosInstance } from 'axios'
import type { RSSItem, ServiceConfig, ConnectionResult, RSSClient } from './types'
import { registerAdapter } from './registry'

export class FreshRSSClient implements RSSClient {
  private client: AxiosInstance | null = null
  private config: ServiceConfig | null = null

  configure(config: ServiceConfig) {
    this.config = config
    const baseUrl = config.baseUrl.replace(/\/$/, '')
    this.client = axios.create({
      baseURL: `${baseUrl}/api/greader.php`,
      timeout: 10000,
      headers: {
        'Authorization': `GoogleLogin auth=${config.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
  }

  isConfigured(): boolean {
    return !!(this.config?.baseUrl && this.config?.apiKey)
  }

  async testConnection(): Promise<ConnectionResult> {
    if (!this.isConfigured() || !this.client) {
      return { success: false, message: '未配置 FreshRSS 地址或 API Key' }
    }
    try {
      // 请求订阅源列表，验证认证是否有效
      const resp = await this.client.get('/reader/api/0/subscription/list?output=json')
      return { success: true, message: `连接成功，共 ${resp.data?.subscriptions?.length ?? 0} 个订阅源` }
    } catch (err: any) {
      const msg = err.response?.status === 401 ? 'API Key 无效' : `连接失败: ${err.message}`
      return { success: false, message: msg }
    }
  }

  async getUnreadItems(limit = 50): Promise<RSSItem[]> {
    if (!this.client) return []
    try {
      const resp = await this.client.get(
        `/reader/api/0/stream/contents/user/-/state/com.google/reading-list?n=${limit}&xt=user/-/state/com.google/read&output=json`
      )
      const items = resp.data?.items ?? []
      return items.map((item: any): RSSItem => ({
        id: item.id ?? '',
        title: item.title ?? '无标题',
        url: item.alternate?.[0]?.href ?? '',
        author: item.author,
        summary: item.summary?.content ?? item.title,
        content: item.content?.content ?? item.summary?.content,
        publishedAt: new Date((item.published ?? 0) * 1000).toISOString(),
        feedTitle: item.origin?.title,
        read: false,
        starred: item.categories?.some((c: string) => c.includes('starred')) ?? false
      }))
    } catch (error) {
      throw new Error(`无法加载 FreshRSS 未读文章: ${getErrorMessage(error)}`)
    }
  }

  async getItemContent(itemId: string): Promise<string> {
    if (!this.client) return ''
    try {
      const resp = await this.client.get(
        `/reader/api/0/stream/contents/contents/${encodeURIComponent(itemId)}?output=json`
      )
      return resp.data?.items?.[0]?.content?.content ?? resp.data?.items?.[0]?.summary?.content ?? ''
    } catch (error) {
      throw new Error(`无法加载文章正文: ${getErrorMessage(error)}`)
    }
  }

  async markAsRead(itemId: string): Promise<void> {
    if (!this.client) return
    try {
      await this.client.post(
        '/reader/api/0/edit-tag',
        `i=${encodeURIComponent(itemId)}&a=user/-/state/com.google/read`
      )
    } catch {}
  }

  async starItem(itemId: string): Promise<void> {
    if (!this.client) return
    try {
      await this.client.post(
        '/reader/api/0/edit-tag',
        `i=${encodeURIComponent(itemId)}&a=user/-/state/com.google/starred`
      )
    } catch {}
  }
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return '网络或服务错误'
}

export const freshRSSClient = new FreshRSSClient()

// 自注册
registerAdapter(
  {
    id: 'freshrss',
    kind: 'rss',
    displayName: 'FreshRSS',
    description: '自建 RSS 聚合阅读器，兼容 Google Reader API',
    configFields: [
      { key: 'baseUrl', label: '服务地址', type: 'url', placeholder: 'https://your-freshrss.example.com', required: true, help: 'FreshRSS 实例地址' },
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '在 FreshRSS 设置 → 账户 → API 管理中生成', required: true }
    ]
  },
  () => new FreshRSSClient()
)
