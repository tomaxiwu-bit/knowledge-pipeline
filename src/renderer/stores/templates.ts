// 模板系统
// 借鉴 Obsidian 的模板核心插件 + Outline 的"文档即模板"设计
// 支持变量替换：{{date}}、{{time}}、{{title}}、{{source_url}}、{{tags}}、{{cursor}}
// 内置模板 + 用户自定义模板（存 electron-store）

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Template {
  id: string
  name: string
  icon: string
  category: 'daily' | 'reading' | 'meeting' | 'rss' | 'custom'
  body: string  // Markdown 模板内容
  builtIn?: boolean
}

// 内置模板
const BUILT_IN_TEMPLATES: Template[] = [
  {
    id: 'tpl-daily',
    name: '每日笔记',
    icon: 'calendar',
    category: 'daily',
    builtIn: true,
    body: `# {{date}} 每日笔记

## 今日速记

{{cursor}}

## 待办

- [ ] 

## 总结

`
  },
  {
    id: 'tpl-reading',
    name: '阅读笔记',
    icon: 'file',
    category: 'reading',
    builtIn: true,
    body: `# {{title}}

> 来源：{{source_url}}
> 日期：{{date}}

## 核心观点

{{cursor}}

## 关键摘录

> 

## 个人思考

`
  },
  {
    id: 'tpl-meeting',
    name: '会议纪要',
    icon: 'note',
    category: 'meeting',
    builtIn: true,
    body: `# 会议纪要 - {{date}}

## 基本信息

- 时间：{{date}} {{time}}
- 参会：

## 议题

1. 

## 讨论记录

{{cursor}}

## 待办事项

- [ ] 
`
  },
  {
    id: 'tpl-rss-digest',
    name: 'RSS 摘要',
    icon: 'rss',
    category: 'rss',
    builtIn: true,
    body: `# RSS 周报 - {{date}}

## 本周精选

{{cursor}}

## 分类摘要

### 技术

### 产品

### 其他

## AI 摘要

`
  }
]

export const useTemplateStore = defineStore('templates', () => {
  const customTemplates = ref<Template[]>([])
  const showPicker = ref(false)
  const loaded = ref(false)

  const allTemplates = computed(() => [...BUILT_IN_TEMPLATES, ...customTemplates.value])

  async function load() {
    if (loaded.value) return
    try {
      const data = await window.kpAPI.settings.get('customTemplates')
      if (Array.isArray(data)) {
        customTemplates.value = data.filter((item): item is Template => {
          return !!item && typeof item === 'object' &&
            typeof item.id === 'string' && typeof item.name === 'string' &&
            typeof item.icon === 'string' && typeof item.body === 'string' &&
            item.category === 'custom'
        })
      }
      loaded.value = true
    } catch (error) {
      console.error('加载自定义模板失败', error)
    }
  }

  async function persist() {
    await window.kpAPI.settings.set('customTemplates', customTemplates.value)
  }

  /** 变量替换 */
  function renderTemplate(body: string, vars?: Record<string, string>): string {
    const now = new Date()
    const defaults: Record<string, string> = {
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      title: '新笔记',
      source_url: '',
      tags: '',
      cursor: ''
    }
    const merged = { ...defaults, ...vars }
    let result = body
    for (const [key, value] of Object.entries(merged)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    }
    return result
  }

  /** 根据模板创建内容 */
  function applyTemplate(template: Template, vars?: Record<string, string>): string {
    return renderTemplate(template.body, vars)
  }

  /** 添加自定义模板 */
  async function addCustomTemplate(tpl: Omit<Template, 'id' | 'builtIn'>) {
    const id = `tpl-custom-${Date.now()}`
    customTemplates.value.push({ ...tpl, id, builtIn: false })
    await persist()
  }

  /** 删除自定义模板 */
  async function removeCustomTemplate(id: string) {
    customTemplates.value = customTemplates.value.filter((t) => t.id !== id)
    await persist()
  }

  /** 打开模板选择器 */
  function openPicker() {
    showPicker.value = true
  }

  function closePicker() {
    showPicker.value = false
  }

  return {
    showPicker,
    loaded,
    allTemplates,
    customTemplates,
    load,
    renderTemplate,
    applyTemplate,
    addCustomTemplate,
    removeCustomTemplate,
    openPicker,
    closePicker
  }
})
