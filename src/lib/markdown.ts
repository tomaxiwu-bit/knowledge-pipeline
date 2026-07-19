// Markdown 渲染工具
// 借鉴 Joplin 的 markdown-it 插件化设计，在 marked 基础上扩展：
// 1. ==高亮== 语法（mark）
// 2. $...$ 和 $$...$$ 数学公式（KaTeX）
// 3. ```mermaid 代码块图表渲染
// 4. 脚注支持 [^1]
// 使用方式：import { renderMarkdown, renderMermaid } from '@/lib/markdown'

import { marked, type Tokens, type TokenizerExtension, type RendererExtension } from 'marked'
import DOMPurify from 'dompurify'

// ==高亮== 扩展
const markExtension: { extensions: (TokenizerExtension & RendererExtension)[] } = {
  extensions: [
    {
      name: 'mark',
      level: 'inline',
      start(src: string) { return src.indexOf('==') },
      tokenizer(src: string, tokens: any[]) {
        const rule = /^==([^=]+)==/
        const match = rule.exec(src)
        if (match) {
          return {
            type: 'mark',
            raw: match[0],
            text: match[1],
            tokens: this.lexer.inlineTokens(match[1])
          }
        }
        return undefined
      },
      renderer(token: any) {
        return `<mark>${this.parser.parseInline(token.tokens)}</mark>`
      }
    }
  ]
}

// 脚注扩展：[^id] 和 [^id]: 定义
const footnoteExtension: { extensions: (TokenizerExtension & RendererExtension)[] } = {
  extensions: [
    {
      name: 'footnoteRef',
      level: 'inline',
      start(src: string) { return src.indexOf('[^') },
      tokenizer(src: string) {
        const rule = /^\[\^([^\]]+)\]/
        const match = rule.exec(src)
        if (match && match[1].includes(':')) return undefined // 定义形式，跳过
        if (match) {
          return {
            type: 'footnoteRef',
            raw: match[0],
            id: match[1]
          }
        }
        return undefined
      },
      renderer(token: any) {
        return `<sup class="footnote-ref"><a href="#fn-${token.id}" id="fnref-${token.id}">[${token.id}]</a></sup>`
      }
    },
    {
      name: 'footnoteDef',
      level: 'block',
      start(src: string) { return src.indexOf('[^') },
      tokenizer(src: string) {
        const rule = /^\[\^([^\]]+)\]:\s+(.+(?:\n(?: {2,}.+|\n))*)/
        const match = rule.exec(src)
        if (match) {
          return {
            type: 'footnoteDef',
            raw: match[0],
            id: match[1],
            text: match[2].trim()
          }
        }
        return undefined
      },
      renderer(token: any) {
        return `<div class="footnote" id="fn-${token.id}"><p>[${token.id}] ${token.text}</p></div>`
      }
    }
  ]
}

// 配置 marked
marked.use(markExtension)
marked.use(footnoteExtension)

/**
 * 渲染 Markdown 为 HTML
 * 支持：标准 Markdown + ==高亮== + 脚注 + 数学公式占位 + Mermaid 占位
 * 数学公式和 Mermaid 需要调用方在渲染后异步处理（见 renderMath 和 renderMermaid）
 */
export function renderMarkdown(content: string): string {
  if (!content) return ''
  let html = marked.parse(content) as string

  // 处理数学公式：$$...$$ 块级 和 $...$ 行内
  // 转换为 KaTeX 可识别的占位符，由 renderMath 异步渲染
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    const escaped = math.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<div class="math-block" data-math="${encodeURIComponent(escaped)}">${escaped}</div>`
  })
  html = html.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    const escaped = math.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<span class="math-inline" data-math="${encodeURIComponent(escaped)}">${escaped}</span>`
  })

  return html
}

/**
 * 异步渲染 Mermaid 图表
 * 在 DOM 插入后调用，查找 code.language-mermaid 块并渲染
 */
export async function renderMermaid(container: HTMLElement | null): Promise<void> {
  if (!container) return
  const mermaidBlocks = container.querySelectorAll('code.language-mermaid')
  if (mermaidBlocks.length === 0) return

  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    // Diagram source can arrive from an RSS item or bookmark. Strict mode
    // disables Mermaid click handlers and unsafe URL-bearing constructs.
    securityLevel: 'strict'
  })

  for (let i = 0; i < mermaidBlocks.length; i++) {
    const block = mermaidBlocks[i] as HTMLElement
    const code = block.textContent || ''
    const id = `mermaid-${Date.now()}-${i}`
    try {
      const { svg } = await mermaid.render(id, code)
      const wrapper = block.parentElement
      if (wrapper) {
        wrapper.innerHTML = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true }
        })
        wrapper.classList.add('mermaid-rendered')
      }
    } catch {
      block.parentElement?.classList.add('mermaid-error')
    }
  }
}

/**
 * 异步渲染 KaTeX 数学公式
 * 在 DOM 插入后调用，查找 .math-block 和 .math-inline 并渲染
 */
export async function renderMath(container: HTMLElement | null): Promise<void> {
  if (!container) return
  const mathElements = container.querySelectorAll('[data-math]')
  if (mathElements.length === 0) return

  const katex = (await import('katex')).default

  for (let i = 0; i < mathElements.length; i++) {
    const el = mathElements[i] as HTMLElement
    const math = decodeURIComponent(el.dataset.math || '')
    const isBlock = el.classList.contains('math-block')
    try {
      katex.render(math, el, {
        displayMode: isBlock,
        throwOnError: false,
        output: 'html'
      })
    } catch {
      // 渲染失败保持原文
    }
  }
}

/**
 * 渲染所有异步内容（Mermaid + KaTeX）
 * 在 Vue 的 onMounted 或 nextTick 后调用
 */
export async function renderAsyncContent(container: HTMLElement | null): Promise<void> {
  await Promise.all([
    renderMermaid(container),
    renderMath(container)
  ])
}
