// 数据导出工具
// 借鉴 Obsidian 的"数据可随时离开"理念和 Joplin 的导出框架设计
// 支持：Markdown（带 frontmatter）、HTML（带样式）、纯文本
// 使用浏览器 Blob + download 触发文件保存，兼容 Electron 环境

import { renderMarkdown } from './markdown'
import DOMPurify from 'dompurify'

export interface ExportMeta {
  title: string
  url?: string
  source?: string         // rss / bookmark / memo / editor
  tags?: string[]
  createdAt?: string
  aiSummary?: string
}

/** 生成 YAML frontmatter */
function generateFrontmatter(meta: ExportMeta): string {
  const lines: string[] = ['---']
  lines.push(`title: "${meta.title.replace(/"/g, '\\"')}"`)
  if (meta.url) lines.push(`source: "${meta.url}"`)
  if (meta.source) lines.push(`type: ${meta.source}`)
  if (meta.createdAt) lines.push(`date: ${meta.createdAt}`)
  if (meta.tags && meta.tags.length > 0) {
    lines.push(`tags:`)
    meta.tags.forEach((t) => lines.push(`  - ${t}`))
  }
  if (meta.aiSummary) {
    lines.push(`ai_summary: |`)
    meta.aiSummary.split('\n').forEach((line) => lines.push(`  ${line}`))
  }
  lines.push('---')
  return lines.join('\n')
}

/** 导出为 Markdown 文件（含 frontmatter） */
export function exportAsMarkdown(content: string, meta: ExportMeta): void {
  const frontmatter = generateFrontmatter(meta)
  const fullContent = `${frontmatter}\n\n${content}\n`
  downloadFile(fullContent, `${sanitizeFilename(meta.title)}.md`, 'text/markdown')
}

/** 导出为 HTML 文件（含内联样式） */
export function exportAsHTML(content: string, meta: ExportMeta): void {
  const html = DOMPurify.sanitize(renderMarkdown(content), {
    ADD_TAGS: ['mark', 'div', 'span'],
    ADD_ATTR: ['data-math']
  })
  const fullHTML = generateHTMLDocument(html, meta)
  downloadFile(fullHTML, `${sanitizeFilename(meta.title)}.html`, 'text/html')
}

/** 导出为纯文本 */
export function exportAsText(content: string, meta: ExportMeta): void {
  downloadFile(content, `${sanitizeFilename(meta.title)}.txt`, 'text/plain')
}

/** 生成完整的 HTML 文档 */
function generateHTMLDocument(bodyHTML: string, meta: ExportMeta): string {
  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeUrl = (value?: string): string | undefined => {
    if (!value) return undefined
    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
    } catch {
      return undefined
    }
  }
  const sourceUrl = safeUrl(meta.url)
  const metaHTML = [
    `<meta charset="UTF-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1.0">`,
    `<title>${escapeHtml(meta.title)}</title>`,
    sourceUrl ? `<link rel="canonical" href="${escapeHtml(sourceUrl)}">` : '',
    `<meta name="generator" content="知识流水线">`
  ].filter(Boolean).join('\n')

  const styleCSS = `
    body { font-family: -apple-system, "Noto Serif SC", Georgia, serif; max-width: 760px; margin: 0 auto; padding: 32px 24px; line-height: 1.85; color: #1a1a2e; }
    h1 { font-size: 26px; font-weight: 700; margin-bottom: 12px; }
    h2 { font-size: 22px; font-weight: 600; margin: 32px 0 16px; }
    h3 { font-size: 19px; font-weight: 600; margin: 24px 0 12px; }
    p { margin-bottom: 18px; }
    a { color: #6366f1; }
    code { background: #f0f0f5; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    pre { background: #f0f0f5; padding: 16px; border-radius: 8px; overflow-x: auto; }
    blockquote { border-left: 3px solid #6366f1; padding-left: 20px; margin: 20px 0; color: #4a4a6a; font-style: italic; }
    img { max-width: 100%; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #e0e0e0; padding: 8px 12px; text-align: left; }
    th { background: #f0f0f5; font-weight: 600; }
    mark { background: rgba(255, 213, 79, 0.4); padding: 1px 4px; border-radius: 2px; }
    .meta { font-size: 13px; color: #8a8aab; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e0e0e0; }
    .ai-summary { background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px; padding: 16px; margin: 20px 0; }
  `

  const metaInfo = [
    sourceUrl ? `<div class="meta">来源：<a href="${escapeHtml(sourceUrl)}" rel="noreferrer noopener">${escapeHtml(sourceUrl)}</a></div>` : '',
    meta.createdAt ? `<div class="meta">日期：${meta.createdAt}</div>` : '',
    meta.tags && meta.tags.length > 0 ? `<div class="meta">标签：${meta.tags.map((t) => `#${t}`).join(' ')}</div>` : ''
  ].filter(Boolean).join('')

  const aiSummaryHTML = meta.aiSummary
    ? `<div class="ai-summary"><strong>🤖 AI 摘要</strong><br>${escapeHtml(meta.aiSummary)}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
${metaHTML}
<style>${styleCSS}</style>
</head>
<body>
<h1>${escapeHtml(meta.title)}</h1>
${metaInfo}
${aiSummaryHTML}
${bodyHTML}
</body>
</html>`
}

/** 触发文件下载 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

/** 文件名清理：去掉非法字符 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'untitled'
}
