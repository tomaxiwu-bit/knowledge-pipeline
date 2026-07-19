<script setup lang="ts">
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import DOMPurify from 'dompurify'
import { useSettingsStore } from '@/renderer/stores/settings'
import { useRelationStore } from '@/renderer/stores/relations'
import { useInquiryThreadStore } from '@/renderer/stores/inquiryThreads'
import { renderMarkdown, renderAsyncContent } from '@/lib/markdown'
import { exportAsMarkdown, exportAsHTML } from '@/lib/export'
import ArticleOutline from '@/renderer/components/ArticleOutline.vue'
import BacklinkPanel from '@/renderer/components/BacklinkPanel.vue'
import type { RSSClient, BookmarkClient, MemoClient, AIClient, AISummary } from '@/services/types'
import type { InquirySourceRole } from '@/lib/inquiry'

const props = defineProps<{
  source: string
  id: string
}>()

const router = useRouter()
const settingsStore = useSettingsStore()
const relationStore = useRelationStore()
const inquiryStore = useInquiryThreadStore()

const title = ref('')
const url = ref('')
const content = ref('')
const loading = ref(true)
const showManualInput = ref(false)
const highlightText = ref('')
const toastMessage = ref('')
const toastTimer = ref<number | null>(null)
const showInquiryDialog = ref(false)
const selectedInquiryId = ref('')
const inquiryRole = ref<InquirySourceRole>('evidence')
const inquiryNote = ref('')
const indexing = ref(false)

// AI 摘要相关状态
const summary = ref<AISummary | null>(null)
const summarizing = ref(false)
const showSummaryStyle = ref(false)
const summaryStyle = ref<'concise' | 'detailed' | 'bullets'>('concise')

function showToast(message: string) {
  toastMessage.value = message
  if (toastTimer.value) window.clearTimeout(toastTimer.value)
  toastTimer.value = window.setTimeout(() => (toastMessage.value = ''), 3000)
}

function getRSSClient(): RSSClient | null {
  return settingsStore.getClientByKind('rss') as RSSClient | null
}
function getBookmarkClient(): BookmarkClient | null {
  return settingsStore.getClientByKind('bookmark') as BookmarkClient | null
}
function getMemoClient(): MemoClient | null {
  return settingsStore.getClientByKind('memo') as MemoClient | null
}
function getAIClient(): AIClient | null {
  return settingsStore.getClientByKind('ai') as AIClient | null
}

const renderedContent = computed(() => {
  if (!content.value) return ''
  const html = renderMarkdown(content.value)
  return DOMPurify.sanitize(html, { ADD_TAGS: ['mark', 'div', 'span'], ADD_ATTR: ['data-math'] })
})

// 渲染异步内容（Mermaid 图表 + KaTeX 公式）
const articleContentRef = ref<HTMLElement | null>(null)
watch(renderedContent, async () => {
  await nextTick()
  await renderAsyncContent(articleContentRef.value)
})

const hasAIClient = computed(() => {
  const c = getAIClient()
  return !!c && c.isConfigured()
})

async function loadContent() {
  loading.value = true
  const itemId = decodeURIComponent(props.id)

  if (props.source === 'rss') {
    const rssClient = getRSSClient()
    if (!rssClient) {
      loading.value = false
      return
    }
    const html = await rssClient.getItemContent(itemId)
    const items = await rssClient.getUnreadItems(50)
    const item = items.find((i) => i.id === itemId)
    if (item) {
      title.value = item.title
      url.value = item.url
      content.value = html || item.content || item.summary
      await rssClient.markAsRead(itemId)
    } else {
      title.value = '文章'
      content.value = html
    }
  } else if (props.source === 'bookmark') {
    const bookmarkClient = getBookmarkClient()
    if (!bookmarkClient) {
      loading.value = false
      return
    }
    const bookmarks = await bookmarkClient.getBookmarks(100)
    const item = bookmarks.find((b) => b.id === itemId)
    if (item) {
      title.value = item.title
      url.value = item.url
      content.value = item.content || item.description || ''
    }
  }
  loading.value = false
}

async function saveHighlightToMemos() {
  const selection = window.getSelection()?.toString().trim()
  if (!selection) {
    showToast('请先选中要保存的文字')
    return
  }
  const memoClient = getMemoClient()
  if (!memoClient) {
    showToast('未配置笔记服务')
    return
  }
  const memoContent = `> ${selection}\n\n来源: [${title.value}](${url.value})`
  const result = await memoClient.createMemo(memoContent)
  if (result) {
    // 自动建立关系：笔记 衍生自 文章
    const itemId = decodeURIComponent(props.id)
    const itemType = props.source === 'rss' ? 'rss' : 'bookmark'
    await relationStore.addRelation({
      sourceType: 'memo',
      sourceId: result.id,
      sourceTitle: selection.slice(0, 40) + (selection.length > 40 ? '...' : ''),
      targetType: itemType,
      targetId: itemId,
      targetTitle: title.value,
      kind: 'derived-from'
    })
  }
  showToast(result ? '已保存到笔记' : '保存失败')
}

async function saveManualHighlight() {
  if (!highlightText.value.trim()) return
  const memoClient = getMemoClient()
  if (!memoClient) {
    showToast('未配置笔记服务')
    return
  }
  const memoContent = `> ${highlightText.value}\n\n来源: [${title.value}](${url.value})`
  const result = await memoClient.createMemo(memoContent)
  if (result) {
    showToast('已保存到笔记')
    // 自动建立关系：笔记 衍生自 文章
    const itemId = decodeURIComponent(props.id)
    const itemType = props.source === 'rss' ? 'rss' : 'bookmark'
    await relationStore.addRelation({
      sourceType: 'memo',
      sourceId: result.id,
      sourceTitle: highlightText.value.slice(0, 40),
      targetType: itemType,
      targetId: itemId,
      targetTitle: title.value,
      kind: 'derived-from'
    })
    highlightText.value = ''
    showManualInput.value = false
  } else {
    showToast('保存失败')
  }
}

async function bookmarkThis() {
  if (!url.value) return
  const bookmarkClient = getBookmarkClient()
  if (!bookmarkClient) {
    showToast('未配置收藏服务')
    return
  }
  // 双来源：RSS 文章收藏时传 entryId，外部链接不传
  const options: { entryId?: string } = {}
  if (props.source === 'rss') {
    options.entryId = decodeURIComponent(props.id)
  }
  const result = await bookmarkClient.createBookmark(url.value, title.value, options)
  if (result && props.source === 'rss') {
    // 自动建立关系：收藏 引用 RSS 文章
    const itemId = decodeURIComponent(props.id)
    await relationStore.addRelation({
      sourceType: 'bookmark',
      sourceId: result.id,
      sourceTitle: title.value,
      targetType: 'rss',
      targetId: itemId,
      targetTitle: title.value,
      kind: 'bookmark-of'
    })
  }
  showToast(result ? '已收藏' : '收藏失败')
}

async function generateSummary() {
  const aiClient = getAIClient()
  if (!aiClient || !aiClient.isConfigured()) {
    showToast('未配置 AI 服务')
    return
  }
  if (!content.value) {
    showToast('暂无内容可摘要')
    return
  }
  summarizing.value = true
  summary.value = null
  try {
    const result = await aiClient.summarize(content.value, {
      style: summaryStyle.value,
      language: '中文'
    })
    summary.value = result
  } catch (e: any) {
    showToast(e.message || '摘要生成失败')
  } finally {
    summarizing.value = false
  }
}

async function saveSummaryToMemo() {
  if (!summary.value) return
  const memoClient = getMemoClient()
  if (!memoClient) {
    showToast('未配置笔记服务')
    return
  }
  const memoContent = `## AI 摘要\n\n${summary.value.content}\n\n来源: [${title.value}](${url.value})\n\n*模型: ${summary.value.model}*`
  const result = await memoClient.createMemo(memoContent)
  if (result) {
    // 自动建立关系：摘要 摘要了 文章
    const itemId = decodeURIComponent(props.id)
    const itemType = props.source === 'rss' ? 'rss' : 'bookmark'
    await relationStore.addRelation({
      sourceType: 'memo',
      sourceId: result.id,
      sourceTitle: `AI 摘要: ${title.value}`,
      targetType: itemType,
      targetId: itemId,
      targetTitle: title.value,
      kind: 'summarizes'
    })
  }
  showToast(result ? '摘要已存到笔记' : '保存失败')
}

async function openInquiryDialog() {
  await inquiryStore.load()
  if (inquiryStore.threads.length === 0) {
    showToast('请先在“探究线”里创建一个要回答的问题')
    return
  }
  selectedInquiryId.value = inquiryStore.threads[0].id
  inquiryRole.value = 'evidence'
  inquiryNote.value = ''
  showInquiryDialog.value = true
}

async function addToInquiry() {
  if (!selectedInquiryId.value || !title.value) return
  const sourceType = props.source === 'rss' ? 'rss' : 'bookmark'
  const source = await inquiryStore.addSource(selectedInquiryId.value, {
    sourceType,
    sourceId: decodeURIComponent(props.id),
    title: title.value,
    url: url.value || undefined,
    role: inquiryRole.value,
    note: inquiryNote.value
  })
  showInquiryDialog.value = false
  showToast(source ? '已加入探究线' : '加入探究线失败')
}

async function addToKnowledge() {
  if (!title.value || !content.value) {
    showToast('暂无可加入知识库的内容')
    return
  }
  indexing.value = true
  try {
    const result = await window.kpAPI.rag.invoke('index', {
      source_type: props.source === 'rss' ? 'rss' : 'bookmark',
      source_id: decodeURIComponent(props.id),
      title: title.value,
      content: content.value,
      ...(url.value ? { url: url.value } : {}),
      tags: []
    }) as { semantic_indexed?: boolean }
    showToast(result.semantic_indexed ? '已加入本地知识库' : '已保存到关键词索引；等待本地嵌入模型')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '加入知识库失败')
  } finally {
    indexing.value = false
  }
}

// 数据导出
function exportMarkdown() {
  if (!content.value) {
    showToast('暂无内容可导出')
    return
  }
  exportAsMarkdown(content.value, {
    title: title.value || '文章',
    url: url.value,
    source: props.source,
    createdAt: new Date().toISOString(),
    aiSummary: summary.value?.content
  })
  showToast('已导出 Markdown')
}

function exportHTML() {
  if (!content.value) {
    showToast('暂无内容可导出')
    return
  }
  exportAsHTML(content.value, {
    title: title.value || '文章',
    url: url.value,
    source: props.source,
    createdAt: new Date().toISOString(),
    aiSummary: summary.value?.content
  })
  showToast('已导出 HTML')
}

onMounted(async () => {
  await Promise.all([relationStore.load(), inquiryStore.load()])
  await loadContent()
})
</script>

<template>
  <div class="reader-view">
    <div class="reader-toolbar">
      <button class="btn btn-secondary" @click="router.back()">← 返回</button>
      <div class="toolbar-actions">
        <button v-if="hasAIClient" class="btn btn-secondary" @click="generateSummary" :disabled="summarizing" title="AI 生成摘要">
          {{ summarizing ? '🤖 生成中...' : '🤖 AI 摘要' }}
        </button>
        <button class="btn btn-secondary" @click="bookmarkThis" title="收藏">
          🔖 收藏
        </button>
        <button class="btn btn-secondary" @click="showManualInput = true" title="手动输入内容存到笔记">
          ✍️ 手动记
        </button>
        <button class="btn btn-secondary" @click="openInquiryDialog" title="将当前材料加入问题驱动的探究线">
          🧭 加入探究线
        </button>
        <button class="btn btn-secondary" @click="addToKnowledge" :disabled="indexing" title="向本地 RAG 知识库建立索引">
          {{ indexing ? '🧠 入库中...' : '🧠 加入知识库' }}
        </button>
        <button class="btn btn-secondary" @click="exportMarkdown" title="导出为 Markdown 文件">
          📄 .md
        </button>
        <button class="btn btn-secondary" @click="exportHTML" title="导出为 HTML 文件">
          🌐 .html
        </button>
        <button class="btn btn-primary" @click="saveHighlightToMemos" title="选中文字后保存到笔记">
          ✏️ 存笔记
        </button>
      </div>
    </div>

    <div v-if="loading" class="reader-loading">
      <p>加载中...</p>
    </div>

    <div v-if="summarizing" class="summary-loading">
      <span class="summary-spinner"></span>
      <p>AI 正在生成摘要...</p>
    </div>

    <div v-if="summary" class="summary-panel">
      <div class="summary-header">
        <h3>🤖 AI 摘要</h3>
        <div class="summary-actions">
          <button class="btn btn-secondary btn-sm" @click="saveSummaryToMemo">存到笔记</button>
          <button class="btn btn-secondary btn-sm" @click="summary = null">关闭</button>
        </div>
      </div>
      <div class="summary-content">{{ summary.content }}</div>
      <div class="summary-meta">
        模型: {{ summary.model }}
        <span v-if="summary.tokensUsed"> · tokens: {{ summary.tokensUsed }}</span>
      </div>
    </div>

    <div v-if="!loading" class="reader-body">
      <article class="reader-article">
        <h1 class="article-title">{{ title }}</h1>
        <div v-if="url" class="article-meta">
          <a :href="url" class="article-url" target="_blank">原文链接 ↗</a>
        </div>
        <div ref="articleContentRef" class="article-content" v-html="renderedContent"></div>
      </article>
      <ArticleOutline :content="renderedContent" />
      <aside class="backlink-sidebar">
        <BacklinkPanel :item-id="decodeURIComponent(id)" :item-type="source === 'rss' ? 'rss' : 'bookmark'" />
      </aside>
    </div>

    <div v-if="showManualInput" class="highlight-modal">
      <div class="modal-content">
        <h3>手动记录</h3>
        <textarea
          v-model="highlightText"
          rows="4"
          placeholder="输入要保存到笔记的内容..."
          class="highlight-input"
        ></textarea>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showManualInput = false">取消</button>
          <button class="btn btn-primary" @click="saveManualHighlight">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showInquiryDialog" class="highlight-modal" @click.self="showInquiryDialog = false">
      <div class="modal-content inquiry-modal">
        <h3>🧭 加入探究线</h3>
        <p class="inquiry-modal-desc">不要只收藏材料：说明它是支持证据、反例、背景，还是你的想法。</p>
        <label class="inquiry-field">
          <span>探究线</span>
          <select v-model="selectedInquiryId" class="highlight-input">
            <option v-for="thread in inquiryStore.threads" :key="thread.id" :value="thread.id">{{ thread.title }}</option>
          </select>
        </label>
        <label class="inquiry-field">
          <span>材料角色</span>
          <select v-model="inquiryRole" class="highlight-input">
            <option value="evidence">支持证据</option>
            <option value="counterpoint">反例 / 保留意见</option>
            <option value="context">背景材料</option>
          </select>
        </label>
        <label class="inquiry-field">
          <span>为什么加入？（可选）</span>
          <textarea v-model="inquiryNote" rows="3" placeholder="它如何影响当前判断？" class="highlight-input"></textarea>
        </label>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showInquiryDialog = false">取消</button>
          <button class="btn btn-primary" @click="addToInquiry">加入</button>
        </div>
      </div>
    </div>

    <transition name="toast">
      <div v-if="toastMessage" class="toast">{{ toastMessage }}</div>
    </transition>
  </div>
</template>

<style scoped>
.reader-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.reader-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.reader-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-muted);
}

.summary-loading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 48px;
  color: var(--accent);
  font-size: 14px;
}

.summary-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--accent-soft);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.summary-panel {
  margin: 16px 48px;
  padding: 20px;
  background: var(--accent-soft);
  border: 1px solid var(--border-active);
  border-radius: var(--radius-lg);
}

.summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.summary-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--accent);
}

.summary-actions {
  display: flex;
  gap: 6px;
}

.summary-content {
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-primary);
  white-space: pre-wrap;
}

.summary-meta {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-muted);
}

.reader-article {
  flex: 1;
  overflow-y: auto;
  padding: 32px 48px 64px;
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
}

.reader-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.backlink-sidebar {
  width: 240px;
  min-width: 240px;
  border-left: 1px solid var(--border-color);
  overflow-y: auto;
  background: var(--bg-secondary);
}

.article-title {
  font-size: 26px;
  font-weight: 700;
  margin-bottom: 12px;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.article-meta {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.article-url {
  font-size: 13px;
  color: var(--accent);
}

.article-content {
  font-size: 16px;
  line-height: 1.85;
  color: var(--text-primary);
  font-family: var(--font-reading);
}

.article-content :deep(h1),
.article-content :deep(h2),
.article-content :deep(h3),
.article-content :deep(h4) {
  margin: 32px 0 16px;
  font-weight: 600;
  font-family: var(--font-sans);
  line-height: 1.3;
  scroll-margin-top: 80px;
}

.article-content :deep(h1) { font-size: 22px; }
.article-content :deep(h2) { font-size: 19px; }
.article-content :deep(h3) { font-size: 17px; }
.article-content :deep(h4) { font-size: 15px; }

.article-content :deep(p) {
  margin-bottom: 18px;
}

.article-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-md);
  margin: 20px 0;
}

.article-content :deep(a) {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-color: var(--accent-soft);
  text-underline-offset: 2px;
}

.article-content :deep(code) {
  background: var(--bg-surface);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.88em;
}

.article-content :deep(pre) {
  background: var(--bg-surface);
  padding: 16px 20px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin: 20px 0;
  font-size: 13px;
  line-height: 1.6;
}

.article-content :deep(pre code) {
  background: transparent;
  padding: 0;
}

.article-content :deep(blockquote) {
  border-left: 3px solid var(--accent);
  padding: 4px 0 4px 20px;
  margin: 20px 0;
  color: var(--text-secondary);
  font-style: italic;
}

.article-content :deep(ul),
.article-content :deep(ol) {
  margin: 16px 0;
  padding-left: 24px;
}

.article-content :deep(li) {
  margin-bottom: 6px;
}

.article-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
}

.article-content :deep(th),
.article-content :deep(td) {
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  text-align: left;
}

.article-content :deep(th) {
  background: var(--bg-surface);
  font-weight: 600;
}

.highlight-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  padding: 24px;
  width: 480px;
  max-width: 90%;
}

.modal-content h3 {
  margin-bottom: 16px;
}

.inquiry-modal-desc {
  margin: -6px 0 14px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.inquiry-field {
  display: block;
  margin-bottom: 12px;
}

.inquiry-field > span {
  display: block;
  margin-bottom: 5px;
  color: var(--text-secondary);
  font-size: 12px;
}

.highlight-input {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 10px;
  color: var(--text-primary);
  resize: vertical;
  margin-bottom: 16px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-elevated);
  color: var(--text-primary);
  padding: 10px 20px;
  border-radius: var(--radius-md);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  font-size: 14px;
  z-index: 200;
  border: 1px solid var(--border-color);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
</style>
