// Memos API 适配器
// 文档: https://usememos.com/docs
// 使用 Access token 认证（统一映射为 ServiceConfig.apiKey）

import axios, { AxiosInstance } from 'axios'
import type { Memo, ServiceConfig, ConnectionResult, MemoClient } from './types'
import { registerAdapter } from './registry'

export class MemosClient implements MemoClient {
  private client: AxiosInstance | null = null
  private config: ServiceConfig | null = null

  configure(config: ServiceConfig) {
    this.config = config
    const baseUrl = config.baseUrl.replace(/\/$/, '')
    this.client = axios.create({
      baseURL: `${baseUrl}/api/v1`,
      timeout: 10000,
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
      return { success: false, message: '未配置 Memos 地址或 Token' }
    }
    try {
      const resp = await this.client.get('/memo')
      return { success: true, message: `连接成功，共 ${resp.data?.memos?.length ?? 0} 条笔记` }
    } catch (err: any) {
      const msg = err.response?.status === 401 ? 'Token 无效' : `连接失败: ${err.message}`
      return { success: false, message: msg }
    }
  }

  async getMemos(limit = 50): Promise<Memo[]> {
    if (!this.client) return []
    try {
      const resp = await this.client.get(`/memo?pageSize=${limit}`)
      const items = resp.data?.memos ?? []
      return items.map((item: any): Memo => ({
        id: String(item.name ?? item.id ?? ''),
        content: item.content ?? '',
        createdAt: item.createTime ?? item.createdTs ?? new Date().toISOString(),
        updatedAt: item.updateTime ?? item.updatedTs ?? new Date().toISOString(),
        tags: this.extractTags(item.content ?? ''),
        pinned: item.pinned ?? false
      }))
    } catch (error) {
      throw new Error(`无法加载 Memos 笔记: ${getErrorMessage(error)}`)
    }
  }

  async createMemo(content: string): Promise<Memo | null> {
    if (!this.client) return null
    try {
      const resp = await this.client.post('/memo', { content })
      const item = resp.data
      return {
        id: String(item.name ?? item.id ?? ''),
        content: item.content ?? content,
        createdAt: item.createTime ?? new Date().toISOString(),
        updatedAt: item.updateTime ?? new Date().toISOString(),
        tags: this.extractTags(item.content ?? content),
        pinned: false
      }
    } catch {
      return null
    }
  }

  async deleteMemo(id: string): Promise<void> {
    if (!this.client) return
    try {
      await this.client.delete(`/memo/${id}`)
    } catch {}
  }

  /** 从 Markdown 内容中提取 #tag 形式的标签 */
  private extractTags(content: string): string[] {
    const matches = content.match(/#[\w\u4e00-\u9fa5]+/g) ?? []
    return [...new Set(matches)]
  }
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return '网络或服务错误'
}

export const memosClient = new MemosClient()

registerAdapter(
  {
    id: 'memos',
    kind: 'memo',
    displayName: 'Memos',
    description: '轻量级速记笔记，支持 Markdown 和标签',
    configFields: [
      { key: 'baseUrl', label: '服务地址', type: 'url', placeholder: 'https://your-memos.example.com', required: true },
      { key: 'apiKey', label: 'Access Token', type: 'password', placeholder: '在 Memos 设置 → Access Token 中生成', required: true }
    ]
  },
  () => new MemosClient()
)
