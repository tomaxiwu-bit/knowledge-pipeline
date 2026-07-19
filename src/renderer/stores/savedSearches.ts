// 保存搜索 / 智能集合 Store
// 借鉴 Trilium 的 search 笔记类型 + Anytype 的 Set 视图
// 将常用搜索条件保存为可重复执行的智能集合

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/** 一个保存的搜索条件 */
export interface SavedSearch {
  id: string
  name: string           // 用户起的名字，如「未读 AI 文章」
  query: string          // 搜索关键词
  tags: string[]         // 保存时选中的标签（空数组表示不限标签）
  createdAt: string
  lastExecutedAt?: string
}

export const useSavedSearchStore = defineStore('savedSearches', () => {
  const searches = ref<SavedSearch[]>([])
  const loaded = ref(false)
  const activeSearchId = ref<string | null>(null)

  /** 从 electron-store 加载 */
  async function load() {
    if (loaded.value) return
    try {
      const data = await window.kpAPI.settings.get('savedSearches')
      if (Array.isArray(data)) {
        searches.value = data
      }
      loaded.value = true
    } catch (e) {
      console.error('加载保存的搜索失败', e)
    }
  }

  /** 持久化 */
  async function persist() {
    try {
      await window.kpAPI.settings.set('savedSearches', searches.value)
    } catch (e) {
      console.error('保存搜索失败', e)
    }
  }

  /** 生成唯一 ID */
  function genId(): string {
    return `search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  /** 保存当前搜索条件 */
  async function addSearch(params: {
    name: string
    query: string
    tags: string[]
  }): Promise<string> {
    const search: SavedSearch = {
      id: genId(),
      name: params.name,
      query: params.query,
      tags: [...params.tags],
      createdAt: new Date().toISOString()
    }
    searches.value.unshift(search)
    await persist()
    return search.id
  }

  /** 删除一个保存的搜索 */
  async function removeSearch(id: string) {
    searches.value = searches.value.filter((s) => s.id !== id)
    if (activeSearchId.value === id) {
      activeSearchId.value = null
    }
    await persist()
  }

  /** 重命名 */
  async function renameSearch(id: string, name: string) {
    const s = searches.value.find((s) => s.id === id)
    if (s) {
      s.name = name
      await persist()
    }
  }

  /** 标记为最近执行 */
  async function markExecuted(id: string) {
    const s = searches.value.find((s) => s.id === id)
    if (s) {
      s.lastExecutedAt = new Date().toISOString()
      await persist()
    }
  }

  /** 设置当前激活的保存搜索 */
  function setActive(id: string | null) {
    activeSearchId.value = id
  }

  /** 获取当前激活的搜索 */
  const activeSearch = computed(() => {
    if (!activeSearchId.value) return null
    return searches.value.find((s) => s.id === activeSearchId.value) || null
  })

  /** 保存的搜索数量 */
  const searchCount = computed(() => searches.value.length)

  return {
    searches,
    loaded,
    activeSearchId,
    activeSearch,
    searchCount,
    load,
    addSearch,
    removeSearch,
    renameSearch,
    markExecuted,
    setActive
  }
})
