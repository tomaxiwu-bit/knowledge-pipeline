import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { normalizeInquiryThreads, type InquirySource, type InquiryThread } from '@/lib/inquiry'

const STORAGE_KEY = 'inquiryThreads'
const MAX_THREADS = 100
const MAX_SOURCES_PER_THREAD = 200

function idFor(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function now(): string {
  return new Date().toISOString()
}

function compactText(value: string, max: number): string {
  return value.trim().slice(0, max)
}

export const useInquiryThreadStore = defineStore('inquiryThreads', () => {
  const threads = ref<InquiryThread[]>([])
  const loaded = ref(false)

  async function load() {
    if (loaded.value) return
    try {
      const data = await window.kpAPI.settings.get(STORAGE_KEY)
      threads.value = normalizeInquiryThreads(data)
    } catch (error) {
      console.error('加载探究线失败', error)
    } finally {
      loaded.value = true
    }
  }

  async function persist() {
    await window.kpAPI.settings.set(STORAGE_KEY, threads.value)
  }

  async function createThread(input: { title: string; question?: string }): Promise<InquiryThread> {
    if (threads.value.length >= MAX_THREADS) throw new Error(`最多可创建 ${MAX_THREADS} 条探究线`)
    const timestamp = now()
    const thread: InquiryThread = {
      id: idFor('inquiry'),
      title: compactText(input.title, 140) || '未命名探究线',
      question: compactText(input.question || '', 2000),
      workingConclusion: '',
      nextAction: '',
      createdAt: timestamp,
      updatedAt: timestamp,
      sources: []
    }
    threads.value.unshift(thread)
    await persist()
    return thread
  }

  async function updateThread(id: string, patch: Pick<InquiryThread, 'title' | 'question' | 'workingConclusion' | 'nextAction'>) {
    const thread = threads.value.find((item) => item.id === id)
    if (!thread) return
    thread.title = compactText(patch.title, 140) || '未命名探究线'
    thread.question = compactText(patch.question, 2000)
    thread.workingConclusion = compactText(patch.workingConclusion, 6000)
    thread.nextAction = compactText(patch.nextAction, 2000)
    thread.updatedAt = now()
    await persist()
  }

  async function addSource(threadId: string, input: Omit<InquirySource, 'id' | 'addedAt'>): Promise<InquirySource | null> {
    const thread = threads.value.find((item) => item.id === threadId)
    if (!thread) return null
    const existing = thread.sources.find((source) => source.sourceType === input.sourceType && source.sourceId === input.sourceId)
    if (existing) return existing
    if (thread.sources.length >= MAX_SOURCES_PER_THREAD) throw new Error(`每条探究线最多可保留 ${MAX_SOURCES_PER_THREAD} 条材料`)

    const source: InquirySource = {
      id: idFor('source'),
      sourceType: input.sourceType,
      sourceId: compactText(input.sourceId, 160),
      title: compactText(input.title, 240) || '未命名材料',
      url: input.url?.slice(0, 2048),
      role: input.role,
      note: compactText(input.note, 2000),
      addedAt: now()
    }
    thread.sources.push(source)
    thread.updatedAt = now()
    await persist()
    return source
  }

  async function removeSource(threadId: string, sourceId: string) {
    const thread = threads.value.find((item) => item.id === threadId)
    if (!thread) return
    thread.sources = thread.sources.filter((source) => source.id !== sourceId)
    thread.updatedAt = now()
    await persist()
  }

  async function removeThread(id: string) {
    threads.value = threads.value.filter((thread) => thread.id !== id)
    await persist()
  }

  const threadCount = computed(() => threads.value.length)

  return {
    threads,
    loaded,
    threadCount,
    load,
    createThread,
    updateThread,
    addSource,
    removeSource,
    removeThread
  }
})
