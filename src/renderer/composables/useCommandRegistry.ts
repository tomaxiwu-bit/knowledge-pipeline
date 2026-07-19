// 全局命令注册表
// 借鉴 AppFlowy 的命令面板设计：命令可来自导航、视图切换、AI 摘要、导入导出等
// 任何模块都可注册命令，命令面板统一展示和过滤

import { ref } from 'vue'

export interface Command {
  id: string                 // 唯一 ID
  title: string              // 显示标题
  icon?: string              // emoji 图标
  description?: string       // 简短描述
  keywords?: string          // 搜索关键词（补充标题之外的匹配）
  category: 'navigate' | 'action' | 'create' | 'settings'
  shortcut?: string          // 快捷键提示文本
  handler: () => void        // 执行函数
}

const commands = ref<Command[]>([])

// 命令面板的可见性（全局共享）
const paletteVisible = ref(false)

/** 打开命令面板 */
function openPalette() {
  paletteVisible.value = true
}

/** 关闭命令面板 */
function closePalette() {
  paletteVisible.value = false
}

/** 切换命令面板 */
function togglePalette() {
  paletteVisible.value = !paletteVisible.value
}

/** 注册一条命令 */
function register(cmd: Command) {
  // 避免重复注册
  const exists = commands.value.find((c) => c.id === cmd.id)
  if (exists) {
    const idx = commands.value.indexOf(exists)
    commands.value[idx] = cmd
  } else {
    commands.value.push(cmd)
  }
}

/** 批量注册 */
function registerAll(cmds: Command[]) {
  cmds.forEach(register)
}

/** 注销命令 */
function unregister(id: string) {
  commands.value = commands.value.filter((c) => c.id !== id)
}

/** 搜索命令：按标题 + 关键词匹配 */
function searchCommands(query: string): Command[] {
  const q = query.toLowerCase().trim()
  if (!q) {
    // 无查询时按分类排序返回全部
    const order: Command['category'][] = ['navigate', 'create', 'action', 'settings']
    return [...commands.value].sort((a, b) => {
      return order.indexOf(a.category) - order.indexOf(b.category)
    })
  }
  return commands.value
    .filter((c) => {
      const haystack = `${c.title} ${c.keywords ?? ''} ${c.description ?? ''}`.toLowerCase()
      return haystack.includes(q)
    })
    .sort((a, b) => {
      // 标题匹配优先
      const aTitle = a.title.toLowerCase().includes(q) ? 0 : 1
      const bTitle = b.title.toLowerCase().includes(q) ? 0 : 1
      return aTitle - bTitle
    })
}

export function useCommandRegistry() {
  return {
    commands,
    paletteVisible,
    register,
    registerAll,
    unregister,
    searchCommands,
    openPalette,
    closePalette,
    togglePalette
  }
}
