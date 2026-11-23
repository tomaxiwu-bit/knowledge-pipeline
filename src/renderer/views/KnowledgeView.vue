<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/renderer/stores/settings'
import { knowledgeClient, type KnowledgeAnswer, type KnowledgeCitation, type KnowledgeDocument, type KnowledgeHealth, type KnowledgeSourceType } from '@/renderer/services/ragClient'
import type { BookmarkClient, MemoClient, RSSClient } from '@/services/types'

const router = useRouter()
const settingsStore = useSettingsStore()
const question = ref('')
const response = ref<KnowledgeAnswer | null>(null)
const health = ref<KnowledgeHealth | null>(null)
const statusMessage = ref('正在检查本地知识服务…')
const asking = ref(false)
const syncing = ref(false)
const syncProgress = ref('')

const ready = computed(() => health.value?.status === 'ok')
const hasSources = computed(() => settingsStore.services.some((service) => service.configured && ['rss', 'bookmark', 'memo'].includes(service.kind)))
const aiService = computed(() => settingsStore.services.find((service) => service.kind === 'ai' && service.configured))

function getClient<T>(kind: 'rss' | 'bookmark' | 'memo'): T | null {
  return settingsStore.getClientByKind(kind) as T | null
}

async function refreshHealth() {
  try {
    health.value = await knowledgeClient.health()
    statusMessage.value = `本地服务就绪：${health.value.storage.documents} 篇材料 / ${health.value.storage.chunks} 个知识片段`
  } catch (error) {
    health.value = null
    statusMessage.value = error instanceof Error ? error.message : '无法连接本地知识服务'
  }
}

async function ask() {
  const query = question.value.trim()
  if (!query) return
  asking.value = true
  response.value = null
  try {
    response.value = await knowledgeClient.ask(query, 8)
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : '提问失败'
  } finally {
    asking.value = false
  }
}

async function indexDocument(document: KnowledgeDocument) {
  if (!document.content.trim() || !document.title.trim()) return
  await knowledgeClient.index(document)
}

async function syncKnowledge() {
  syncing.value = true
  let indexed = 0
  let failed = 0
  try {
    const rss = getClient<RSSClient>('rss')
    if (rss?.isConfigured()) {
      const items = await rss.getUnreadItems(60)
      for (const item of items) {
        syncProgress.value = `正在索引 RSS：${item.title}`
        try {
          await indexDocument({
            source_type: 'rss', source_id: item.id, title: item.title || '未命名 RSS 文章',
            content: item.content || item.summary, url: item.url, tags: item.feedTitle ? [item.feedTitle] : []
          })
          indexed++
        } catch { failed++ }
      }
    }

    const bookmarks = getClient<BookmarkClient>('bookmark')
    if (bookmarks?.isConfigured()) {
      const items = await bookmarks.getBookmarks(100)
      for (const item of items) {
        syncProgress.value = `正在索引收藏：${item.title}`
        try {
          await indexDocument({
            source_type: 'bookmark', source_id: item.id, title: item.title || '未命名收藏',
            content: item.content || item.description || item.title, url: item.url, tags: item.tags || []
          })
          indexed++
        } catch { failed++ }
      }
    }

    const memos = getClient<MemoClient>('memo')
    if (memos?.isConfigured()) {
      const items = await memos.getMemos(100)
      for (const item of items) {
        syncProgress.value = '正在索引速记笔记…'
        try {
          await indexDocument({
            source_type: 'memo', source_id: item.id, title: item.content.slice(0, 64) || '未命名速记',
            content: item.content, tags: item.tags || []
          })
          indexed++
        } catch { failed++ }
      }
    }
    syncProgress.value = `同步完成：${indexed} 篇材料已更新${failed ? `，${failed} 篇未能索引` : ''}`
    await refreshHealth()
  } catch (error) {
    syncProgress.value = error instanceof Error ? `同步中断：${error.message}` : '同步中断'
  } finally {
    syncing.value = false
  }
}

function openCitation(citation: KnowledgeCitation) {
  if (citation.source_type === 'rss' || citation.source_type === 'bookmark') {
    router.push(`/reader/${citation.source_type}/${encodeURIComponent(citation.source_id)}`)
    return
  }
  if (citation.url) window.open(citation.url, '_blank', 'noopener')
}

onMounted(async () => { await settingsStore.load(); await refreshHealth() })
</script>

<template>
  <div class="knowledge-view">
    <header class="knowledge-header">
      <div>
        <p class="eyebrow">LOCAL RAG WORKBENCH</p>
        <h1>知识问答</h1>
        <p class="subtitle">从本机 RSS、收藏和笔记中检索证据，回答附带可追溯来源。{{ aiService ? `作答服务：${aiService.name}。问题和检索片段会发送到该 API。` : '未配置 AI API 时使用本地 Ollama；不可用时仅展示检索证据。' }}</p>
      </div>
      <div class="service-status" :class="{ online: ready }">
        <span class="status-dot"></span>
        {{ ready ? '本地服务已连接' : '本地服务未连接' }}
      </div>
    </header>

    <section class="control-card">
      <div class="control-copy">
        <h2>建立你的可问答知识库</h2>
        <p>{{ statusMessage }}</p>
      </div>
      <div class="control-actions">
        <button class="btn btn-secondary" @click="refreshHealth">检查服务</button>
        <button class="btn btn-primary" :disabled="syncing || !ready || !hasSources" @click="syncKnowledge">
          {{ syncing ? '同步中…' : '同步已连接来源' }}
        </button>
      </div>
      <p v-if="!hasSources" class="hint">请先在设置中连接 RSS、收藏或笔记服务，然后在这里同步材料。</p>
      <p v-if="syncProgress" class="progress">{{ syncProgress }}</p>
    </section>

    <section class="ask-card">
      <label for="knowledge-question">向你的知识库提问</label>
      <div class="ask-row">
        <textarea
          id="knowledge-question"
          v-model="question"
          rows="3"
          :disabled="!ready || asking"
          placeholder="例如：我收集的材料对本地优先知识管理有什么共识和分歧？"
          @keydown.meta.enter.prevent="ask"
          @keydown.ctrl.enter.prevent="ask"
        ></textarea>
        <button class="btn btn-primary ask-button" :disabled="!ready || asking || !question.trim()" @click="ask">
          {{ asking ? '检索与作答中…' : '提出问题' }}
        </button>
      </div>
      <p class="hint">Ctrl / Cmd + Enter 提问。系统先融合关键词检索和向量检索，再进行本地重排。</p>
    </section>

    <section v-if="response" class="answer-card">
      <div class="answer-meta">
        <span>{{ response.mode === 'grounded_generation' ? `已基于证据作答${response.model ? ` · ${response.model}` : ' · 本地模型'}` : '检索模式：暂无生成回答' }}</span>
        <span>关键词 {{ response.retrieval.keyword_candidates }} · 向量 {{ response.retrieval.vector_candidates }} · {{ response.retrieval.reranker }}</span>
      </div>
      <h2>{{ response.query }}</h2>
      <div class="answer-text">{{ response.answer }}</div>

      <div class="evidence-section">
        <h3>证据与出处</h3>
        <button v-for="citation in response.citations" :key="citation.chunk_id" class="citation" @click="openCitation(citation)">
          <span class="citation-index">{{ citation.index }}</span>
          <span class="citation-copy">
            <strong>{{ citation.title }}</strong>
            <small>{{ citation.source_type }} · {{ citation.excerpt }}</small>
          </span>
          <span class="citation-arrow">↗</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.knowledge-view { height: 100%; overflow-y: auto; padding: 36px; background: transparent; }
.knowledge-header { max-width: 900px; margin: 0 auto 24px; display: flex; gap: 24px; align-items: flex-start; justify-content: space-between; }
.eyebrow { color: var(--accent); font-size: 11px; font-weight: 700; letter-spacing: .13em; margin-bottom: 8px; }
h1 { font-size: 30px; letter-spacing: -.03em; margin-bottom: 10px; }
.subtitle { max-width: 650px; color: var(--text-secondary); line-height: 1.7; }
.service-status { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px; padding: 8px 11px; border: 1px solid var(--border-color); border-radius: 999px; color: var(--text-muted); font-size: 12px; }
.service-status.online { color: var(--success); border-color: color-mix(in srgb, var(--success) 45%, var(--border-color)); }
.status-dot { width: 7px; height: 7px; background: var(--text-muted); border-radius: 50%; }
.online .status-dot { background: var(--success); box-shadow: 0 0 0 4px color-mix(in srgb, var(--success) 14%, transparent); }
.control-card, .ask-card, .answer-card { max-width: 900px; margin: 0 auto 18px; padding: 22px; border: 1px solid var(--border-color); border-radius: var(--radius-lg); background: var(--bg-surface); }
.control-card { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.control-copy { flex: 1 1 380px; }
h2 { font-size: 18px; margin-bottom: 7px; }
.control-copy p, .hint { color: var(--text-secondary); font-size: 13px; line-height: 1.6; }
.control-actions { display: flex; gap: 8px; }
.hint, .progress { flex-basis: 100%; margin-top: -4px; }
.progress { color: var(--accent); font-size: 13px; }
.ask-card label { display: block; font-size: 15px; font-weight: 600; margin-bottom: 12px; }
.ask-row { display: flex; gap: 12px; align-items: stretch; }
textarea { flex: 1; min-height: 78px; resize: vertical; border: 1px solid var(--border-color); background: var(--bg-primary); border-radius: var(--radius-md); padding: 12px; color: var(--text-primary); font: inherit; line-height: 1.55; }
textarea:focus { outline: none; border-color: var(--border-active); }
.ask-button { min-width: 118px; }
.answer-meta { display: flex; justify-content: space-between; gap: 16px; color: var(--text-muted); font-size: 12px; margin-bottom: 16px; }
.answer-text { white-space: pre-wrap; color: var(--text-primary); line-height: 1.8; }
.evidence-section { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--border-color); }
.evidence-section h3 { margin-bottom: 10px; font-size: 14px; }
.citation { width: 100%; display: flex; align-items: flex-start; gap: 10px; text-align: left; padding: 12px; margin-top: 7px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-primary); color: var(--text-primary); }
.citation:hover { border-color: var(--border-active); background: var(--bg-surface-hover); }
.citation-index { width: 22px; height: 22px; display: inline-grid; place-items: center; flex: 0 0 auto; border-radius: 50%; background: var(--accent-soft); color: var(--accent); font-size: 12px; font-weight: 700; }
.citation-copy { min-width: 0; flex: 1; display: grid; gap: 4px; }
.citation-copy strong { font-size: 13px; }
.citation-copy small { display: block; overflow: hidden; color: var(--text-secondary); font-size: 12px; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
.citation-arrow { color: var(--accent); }
@media (max-width: 680px) { .knowledge-view { padding: 22px 16px; } .knowledge-header, .ask-row, .answer-meta { flex-direction: column; } .service-status { align-self: flex-start; } .ask-button { min-height: 42px; } }
</style>
