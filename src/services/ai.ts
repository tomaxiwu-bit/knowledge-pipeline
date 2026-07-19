// AI 摘要适配器
// 兼容 OpenAI Chat Completions API 格式，同时支持：
// - OpenAI 官方 API
// - 任何 OpenAI 兼容代理（如 Azure OpenAI、第三方中转）
// - 本地 Ollama（开启 OLLAMA_ORIGINS 后暴露 /v1/chat/completions 端点）
// 文档: https://platform.openai.com/docs/api-reference/chat

import axios, { AxiosInstance } from 'axios'
import type { AISummary, AIConfig, ConnectionResult, AIClient, AISummaryOptions } from './types'
import { registerAdapter } from './registry'

export class OpenAIClient implements AIClient {
  private client: AxiosInstance | null = null
  private config: AIConfig | null = null

  configure(config: AIConfig) {
    this.config = config
    const baseUrl = config.baseUrl.replace(/\/$/, '')
    this.client = axios.create({
      baseURL: `${baseUrl}/v1`,
      timeout: 60000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    })
  }

  isConfigured(): boolean {
    return !!(this.config?.baseUrl && this.config?.model)
  }

  async testConnection(): Promise<ConnectionResult> {
    if (!this.isConfigured() || !this.client || !this.config) {
      return { success: false, message: '未配置 AI 服务地址或模型' }
    }
    const config = this.config
    try {
      // 用一次最便宜的请求验证连通性
      const resp = await this.client.post('/chat/completions', {
        model: config.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5
      })
      if (resp.data?.choices?.[0]?.message?.content) {
        return { success: true, message: `连接成功，模型: ${config.model}` }
      }
      return { success: false, message: '响应格式异常' }
    } catch (err: any) {
      const msg = err.response?.status === 401 ? 'API Key 无效' : `连接失败: ${err.message}`
      return { success: false, message: msg }
    }
  }

  async summarize(text: string, options?: AISummaryOptions): Promise<AISummary> {
    if (!this.client || !this.config) {
      throw new Error('AI 客户端未配置')
    }

    const stylePrompt = this.buildStylePrompt(options?.style ?? 'concise')
    const langHint = options?.language ? `请用${options.language}输出。` : '请用中文输出。'
    const lengthHint = options?.maxLength ? `控制在 ${options.maxLength} 字以内。` : '控制在 300 字以内。'

    // 文本过长时截断，避免超出 token 限制
    const truncated = text.length > 8000 ? text.slice(0, 8000) + '\n\n[文本已截断]' : text

    const systemPrompt = `你是一个专业的文本摘要助手。${stylePrompt} ${langHint} ${lengthHint}`
    const userPrompt = `请对以下内容生成摘要：\n\n${truncated}`

    try {
      const resp = await this.client.post('/chat/completions', {
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: options?.maxLength ? Math.min(options.maxLength * 2, 2000) : 800
      })

      const content = resp.data?.choices?.[0]?.message?.content ?? ''
      return {
        content,
        model: this.config.model,
        createdAt: new Date().toISOString(),
        tokensUsed: resp.data?.usage?.total_tokens
      }
    } catch (err: any) {
      throw new Error(`摘要生成失败: ${err.message}`)
    }
  }

  private buildStylePrompt(style: 'concise' | 'detailed' | 'bullets'): string {
    switch (style) {
      case 'detailed':
        return '请生成详细摘要，保留关键细节和论据。'
      case 'bullets':
        return '请用要点列表形式输出，每个要点一行，提炼核心信息。'
      case 'concise':
      default:
        return '请生成简明扼要的摘要，只保留核心观点。'
    }
  }
}

// 默认客户端实例（用第一个配置的 AI 后端）
export const aiClient = new OpenAIClient()

// 注册 OpenAI 兼容适配器
registerAdapter(
  {
    id: 'openai',
    kind: 'ai',
    displayName: 'OpenAI 兼容',
    description: '支持 OpenAI 官方、Azure、第三方中转、本地 Ollama 等',
    configFields: [
      { key: 'baseUrl', label: '服务地址', type: 'url', placeholder: 'https://api.openai.com 或 http://localhost:11434', required: true, help: 'OpenAI 官方或兼容 API 地址；本地 Ollama 填 http://localhost:11434' },
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-... 本地 Ollama 可填任意值', required: true },
      { key: 'model', label: '模型名', type: 'text', placeholder: 'gpt-4o-mini / qwen2.5:7b / llama3.1', required: true, help: 'OpenAI 模型或 Ollama 本地模型名' }
    ]
  },
  () => new OpenAIClient()
)
