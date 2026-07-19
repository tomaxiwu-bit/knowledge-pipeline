// 标签系统 Store
// 借鉴 SiYuan 的标签设计：支持层级标签（/ 分隔）、多对多关联、与搜索联动
// 从收藏和笔记中聚合标签，提供标签过滤能力

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSettingsStore } from '@/renderer/stores/settings'
import type { Bookmark, Memo, BookmarkClient, MemoClient } from '@/services/types'

export interface TagNode {
  name: string           // 标签全名（如 "技术/前端"）
  shortName: string      // 最后一级名（如 "前端"）
  count: number          // 该标签出现次数
  children: TagNode[]    // 子标签
}

export interface TagEntry {
  tag: string
  source: 'bookmark' | 'memo'
  itemId: string
  itemTitle: string
  date: string
}

export const useTagStore = defineStore('tags', () => {
  const tags = ref<TagEntry[]>([])
  const loading = ref(false)
  const selectedTags = ref<string[]>([])

  /** 从所有来源加载标签 */
  async function loadAllTags() {
    loading.value = true
    const settingsStore = useSettingsStore()
    const entries: TagEntry[] = []

    const tasks: Promise<void>[] = []

    // 从收藏获取标签
    const bookmarkClient = settingsStore.getClientByKind('bookmark') as BookmarkClient | null
    if (bookmarkClient && bookmarkClient.isConfigured()) {
      tasks.push((async () => {
        try {
          const items: Bookmark[] = await bookmarkClient.getBookmarks(200)
          for (const item of items) {
            for (const tag of item.tags) {
              entries.push({
                tag: normalizeTag(tag),
                source: 'bookmark',
                itemId: item.id,
                itemTitle: item.title,
                date: item.createdAt
              })
            }
          }
        } catch {}
      })())
    }

    // 从笔记获取标签
    const memoClient = settingsStore.getClientByKind('memo') as MemoClient | null
    if (memoClient && memoClient.isConfigured()) {
      tasks.push((async () => {
        try {
          const items: Memo[] = await memoClient.getMemos(200)
          for (const item of items) {
            for (const tag of item.tags) {
              entries.push({
                tag: normalizeTag(tag),
                source: 'memo',
                itemId: item.id,
                itemTitle: item.content.slice(0, 40),
                date: item.createdAt
              })
            }
          }
        } catch {}
      })())
    }

    await Promise.all(tasks)
    tags.value = entries
    loading.value = false
  }

  /** 归一化标签：去掉 #，支持 / 分隔的层级 */
  function normalizeTag(raw: string): string {
    let t = raw.trim()
    if (t.startsWith('#')) t = t.slice(1)
    return t
  }

  /** 所有标签的唯一列表 + 计数 */
  const tagCounts = computed(() => {
    const map = new Map<string, number>()
    for (const entry of tags.value) {
      map.set(entry.tag, (map.get(entry.tag) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
  })

  /** 构建层级标签树 */
  const tagTree = computed<TagNode[]>(() => {
    const root: TagNode[] = []
    const nodeMap = new Map<string, TagNode>()

    for (const { tag, count } of tagCounts.value) {
      const parts = tag.split('/')
      let currentLevel = root
      let path = ''

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim()
        if (!part) continue
        path = path ? `${path}/${part}` : part
        const isLeaf = i === parts.length - 1

        if (!nodeMap.has(path)) {
          const node: TagNode = {
            name: path,
            shortName: part,
            count: 0,
            children: []
          }
          nodeMap.set(path, node)
          currentLevel.push(node)
        }

        const node = nodeMap.get(path)!
        if (isLeaf) {
          node.count += count
        }
        currentLevel = node.children
      }
    }

    // 排序：子节点多的在前，其次按名称
    const sortTree = (nodes: TagNode[]) => {
      nodes.sort((a, b) => {
        if (b.children.length !== a.children.length) {
          return b.children.length - a.children.length
        }
        return a.shortName.localeCompare(b.shortName)
      })
      nodes.forEach((n) => sortTree(n.children))
    }
    sortTree(root)

    return root
  })

  /** 过滤选中的标签对应的条目 */
  const filteredEntries = computed(() => {
    if (selectedTags.value.length === 0) return tags.value
    return tags.value.filter((e) =>
      selectedTags.value.some((sel) => e.tag === sel || e.tag.startsWith(sel + '/'))
    )
  })

  /** 切换标签选中 */
  function toggleTag(tag: string) {
    const idx = selectedTags.value.indexOf(tag)
    if (idx >= 0) {
      selectedTags.value.splice(idx, 1)
    } else {
      selectedTags.value.push(tag)
    }
  }

  /** 清除选中 */
  function clearSelection() {
    selectedTags.value = []
  }

  /** 根据选中的标签获取对应的条目 ID */
  function getItemIdsBySelectedTags(): Set<string> {
    const ids = new Set<string>()
    for (const entry of filteredEntries.value) {
      ids.add(entry.itemId)
    }
    return ids
  }

  return {
    tags,
    loading,
    selectedTags,
    tagCounts,
    tagTree,
    filteredEntries,
    loadAllTags,
    toggleTag,
    clearSelection,
    getItemIdsBySelectedTags
  }
})
