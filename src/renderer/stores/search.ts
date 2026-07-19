import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useSettingsStore } from '@/renderer/stores/settings'
import type { RSSItem, Bookmark, Memo, RSSClient, BookmarkClient, MemoClient } from '@/services/types'

export interface SearchResult {
  type: 'rss' | 'bookmark' | 'memo'
  id: string
  title: string
  snippet: string
  url?: string
  date: string
}

export const useSearchStore = defineStore('search', () => {
  const query = ref('')
  const results = ref<SearchResult[]>([])
  const loading = ref(false)
  const searched = ref(false)

  function match(text: string, q: string): boolean {
    return text.toLowerCase().includes(q.toLowerCase())
  }

  function makeSnippet(text: string, q: string, len = 100): string {
    const lower = text.toLowerCase()
    const idx = lower.indexOf(q.toLowerCase())
    if (idx < 0) return text.slice(0, len)
    const start = Math.max(0, idx - 30)
    const end = Math.min(text.length, start + len)
    return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '')
  }

  async function search() {
    const q = query.value.trim()
    if (!q) {
      results.value = []
      searched.value = false
      return
    }
    loading.value = true
    searched.value = true
    const out: SearchResult[] = []

    const settingsStore = useSettingsStore()
    const tasks: Promise<void>[] = []

    const rssClient = settingsStore.getClientByKind('rss') as RSSClient | null
    if (rssClient && rssClient.isConfigured()) {
      tasks.push((async () => {
        try {
          const items: RSSItem[] = await rssClient.getUnreadItems(100)
          for (const it of items) {
            if (match(it.title, q) || match(it.summary, q)) {
              out.push({
                type: 'rss',
                id: it.id,
                title: it.title,
                snippet: makeSnippet(it.summary || it.title, q),
                url: it.url,
                date: it.publishedAt
              })
            }
          }
        } catch {}
      })())
    }

    const bookmarkClient = settingsStore.getClientByKind('bookmark') as BookmarkClient | null
    if (bookmarkClient && bookmarkClient.isConfigured()) {
      tasks.push((async () => {
        try {
          const items: Bookmark[] = await bookmarkClient.getBookmarks(100)
          for (const it of items) {
            const haystack = `${it.title} ${it.description ?? ''} ${it.content ?? ''}`
            if (match(haystack, q)) {
              out.push({
                type: 'bookmark',
                id: it.id,
                title: it.title,
                snippet: makeSnippet(it.description || it.title, q),
                url: it.url,
                date: it.createdAt
              })
            }
          }
        } catch {}
      })())
    }

    const memoClient = settingsStore.getClientByKind('memo') as MemoClient | null
    if (memoClient && memoClient.isConfigured()) {
      tasks.push((async () => {
        try {
          const items: Memo[] = await memoClient.getMemos(100)
          for (const it of items) {
            if (match(it.content, q)) {
              out.push({
                type: 'memo',
                id: it.id,
                title: it.content.slice(0, 40) + (it.content.length > 40 ? '...' : ''),
                snippet: makeSnippet(it.content, q, 150),
                date: it.createdAt
              })
            }
          }
        } catch {}
      })())
    }

    await Promise.all(tasks)
    // 按日期倒序（date 为 ISO 字符串，可直接用 localeCompare 比较，避免 new Date() 跨时区偏差）
    out.sort((a, b) => b.date.localeCompare(a.date))
    results.value = out
    loading.value = false
  }

  function clear() {
    query.value = ''
    results.value = []
    searched.value = false
  }

  return { query, results, loading, searched, search, clear }
})
