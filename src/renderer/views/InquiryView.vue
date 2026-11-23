<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { buildInquiryBrief, INQUIRY_ROLE_LABELS } from '@/lib/inquiry'
import AppIcon from '@/renderer/components/AppIcon.vue'
import { exportAsMarkdown } from '@/lib/export'
import { useInquiryThreadStore } from '@/renderer/stores/inquiryThreads'
import { useSettingsStore } from '@/renderer/stores/settings'
import type { MemoClient } from '@/services/types'

const router = useRouter()
const inquiryStore = useInquiryThreadStore()
const settingsStore = useSettingsStore()

const activeThreadId = ref('')
const newThreadTitle = ref('')
const newThreadQuestion = ref('')
const reflection = ref('')
const notice = ref('')
const draft = reactive({
  title: '',
  question: '',
  workingConclusion: '',
  nextAction: ''
})

const activeThread = computed(() => inquiryStore.threads.find((thread) => thread.id === activeThreadId.value) ?? null)
const hasMemoService = computed(() => {
  const client = settingsStore.getClientByKind('memo') as MemoClient | null
  return !!client && client.isConfigured()
})

watch(activeThread, (thread) => {
  if (!thread) {
    Object.assign(draft, { title: '', question: '', workingConclusion: '', nextAction: '' })
    return
  }
  Object.assign(draft, {
    title: thread.title,
    question: thread.question,
    workingConclusion: thread.workingConclusion,
    nextAction: thread.nextAction
  })
}, { immediate: true })

watch(() => inquiryStore.threads, (threads) => {
  if (!activeThreadId.value && threads.length > 0) activeThreadId.value = threads[0].id
  if (activeThreadId.value && !threads.some((thread) => thread.id === activeThreadId.value)) {
    activeThreadId.value = threads[0]?.id ?? ''
  }
}, { immediate: true, deep: true })

function showNotice(message: string) {
  notice.value = message
  window.setTimeout(() => {
    if (notice.value === message) notice.value = ''
  }, 2800)
}

async function createThread() {
  if (!newThreadTitle.value.trim()) {
    showNotice('先给这条探究线起一个名字')
    return
  }
  const thread = await inquiryStore.createThread({
    title: newThreadTitle.value,
    question: newThreadQuestion.value
  })
  activeThreadId.value = thread.id
  newThreadTitle.value = ''
  newThreadQuestion.value = ''
}

async function saveThread() {
  if (!activeThread.value) return
  await inquiryStore.updateThread(activeThread.value.id, draft)
  showNotice('探究线已保存')
}

async function deleteThread() {
  if (!activeThread.value || !confirm(`删除“${activeThread.value.title}”及其材料？`)) return
  await inquiryStore.removeThread(activeThread.value.id)
}

async function removeSource(sourceId: string) {
  if (!activeThread.value) return
  await inquiryStore.removeSource(activeThread.value.id, sourceId)
}

function openSource(source: { sourceType: 'rss' | 'bookmark' | 'memo'; sourceId: string }) {
  if (source.sourceType === 'rss' || source.sourceType === 'bookmark') {
    router.push(`/reader/${source.sourceType}/${encodeURIComponent(source.sourceId)}`)
  } else {
    router.push('/')
  }
}

async function addReflection() {
  if (!activeThread.value || !reflection.value.trim()) return
  const client = settingsStore.getClientByKind('memo') as MemoClient | null
  if (!client || !client.isConfigured()) {
    showNotice('请先配置速记笔记服务')
    return
  }

  const content = `## ${activeThread.value.title}\n\n${reflection.value.trim()}`
  try {
    const memo = await client.createMemo(content)
    if (!memo) throw new Error('笔记服务没有返回结果')
    await inquiryStore.addSource(activeThread.value.id, {
      sourceType: 'memo',
      sourceId: memo.id,
      title: reflection.value.trim().slice(0, 80),
      role: 'reflection',
      note: '在探究线中记录的想法'
    })
    reflection.value = ''
    showNotice('想法已保存并加入探究线')
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '保存想法失败')
  }
}

function exportBrief() {
  if (!activeThread.value) return
  exportAsMarkdown(buildInquiryBrief(activeThread.value), {
    title: `${activeThread.value.title}-探究简报`,
    source: 'inquiry-thread',
    createdAt: activeThread.value.updatedAt
  })
  showNotice('探究简报已导出')
}

onMounted(async () => {
  await Promise.all([settingsStore.load(), inquiryStore.load()])
})
</script>

<template>
  <div class="inquiry-view">
    <aside class="inquiry-sidebar">
      <div class="sidebar-heading">
        <div>
          <p class="eyebrow">独有工作流</p>
          <h1>探究线</h1>
        </div>
        <span class="thread-count">{{ inquiryStore.threadCount }}</span>
      </div>
      <p class="sidebar-description">用一个问题，把证据、反例、想法和下一步串成可导出的思考闭环。</p>

      <form class="new-thread-card" @submit.prevent="createThread">
        <label for="thread-title">新探究线</label>
        <input id="thread-title" v-model="newThreadTitle" class="form-input" placeholder="例如：离线缓存该如何设计？" />
        <textarea v-model="newThreadQuestion" class="form-input compact-textarea" rows="2" placeholder="要回答的问题（可选）"></textarea>
        <button class="btn btn-primary" type="submit">+ 开始探究</button>
      </form>

      <div class="thread-list">
        <button
          v-for="thread in inquiryStore.threads"
          :key="thread.id"
          class="thread-item"
          :class="{ active: thread.id === activeThreadId }"
          @click="activeThreadId = thread.id"
        >
          <strong>{{ thread.title }}</strong>
          <span>{{ thread.sources.length }} 条材料 · {{ new Date(thread.updatedAt).toLocaleDateString('zh-CN') }}</span>
        </button>
      </div>
    </aside>

    <main v-if="activeThread" class="inquiry-main">
      <header class="inquiry-header">
        <div>
          <p class="eyebrow">Question → evidence → judgment → next move</p>
          <h2>{{ activeThread.title }}</h2>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" @click="exportBrief">导出简报</button>
          <button class="btn btn-secondary danger-action" @click="deleteThread">删除</button>
        </div>
      </header>

      <section class="thread-form">
        <label>
          <span>探究问题</span>
          <textarea v-model="draft.question" rows="2" class="form-input" placeholder="这个问题值得验证什么？"></textarea>
        </label>
        <label>
          <span>当前判断</span>
          <textarea v-model="draft.workingConclusion" rows="4" class="form-input" placeholder="先写下暂时的理解；它可以随着材料变化。"></textarea>
        </label>
        <label>
          <span>下一步</span>
          <textarea v-model="draft.nextAction" rows="2" class="form-input" placeholder="再找一个反例、验证一个来源，或把判断写成文章。"></textarea>
        </label>
        <div class="form-footer">
          <span>最后更新：{{ new Date(activeThread.updatedAt).toLocaleString('zh-CN') }}</span>
          <button class="btn btn-primary" @click="saveThread">保存判断</button>
        </div>
      </section>

      <section class="materials-section">
        <div class="section-heading">
          <div>
            <h3>材料与想法</h3>
            <p>在阅读页使用“加入探究线”把文章或收藏归入不同角色。</p>
          </div>
          <span class="material-count">{{ activeThread.sources.length }}</span>
        </div>

        <div v-if="activeThread.sources.length" class="source-list">
          <article v-for="source in activeThread.sources" :key="source.id" class="source-card">
            <div class="source-role">
              {{ INQUIRY_ROLE_LABELS[source.role] }}
            </div>
            <div class="source-body">
              <button class="source-title" @click="openSource(source)">{{ source.title }}</button>
              <p v-if="source.note" class="source-note">{{ source.note }}</p>
              <span class="source-meta">收入于 {{ new Date(source.addedAt).toLocaleString('zh-CN') }}</span>
            </div>
            <button class="remove-source" title="从探究线移除" @click="removeSource(source.id)">×</button>
          </article>
        </div>
        <div v-else class="materials-empty">
          <AppIcon name="inbox" :size="22" class="empty-glyph" />
          <p>从一篇文章或收藏开始：它不必立刻支持你的判断，也可以是一个值得保留的反例。</p>
        </div>
      </section>

      <section class="reflection-card">
        <div>
          <h3>留下自己的想法</h3>
          <p>这会新建一条速记笔记，并作为“自己的想法”保留在当前探究线中。</p>
        </div>
        <textarea v-model="reflection" class="form-input" rows="3" placeholder="我现在怎么看？有什么不确定？"></textarea>
        <button class="btn btn-secondary" :disabled="!reflection.trim() || !hasMemoService" @click="addReflection">
          保存想法
        </button>
        <p v-if="!hasMemoService" class="service-hint">需要先配置 Memos 等速记服务。</p>
      </section>
    </main>

    <main v-else class="inquiry-empty">
      <AppIcon name="compass" :size="40" class="empty-glyph" />
      <h2>从一个值得回答的问题开始</h2>
      <p>探究线不是文件夹，也不是图谱。它帮助你留下“为什么收集、现在怎么判断、下一步做什么”。</p>
    </main>

    <transition name="toast">
      <div v-if="notice" class="toast">{{ notice }}</div>
    </transition>
  </div>
</template>

<style scoped>
.inquiry-view { display: flex; height: 100%; background: var(--bg-primary); overflow: hidden; }
.inquiry-sidebar { width: 300px; min-width: 300px; padding: 24px 18px; overflow-y: auto; border-right: 1px solid var(--border-color); background: var(--bg-secondary); }
.sidebar-heading, .inquiry-header, .section-heading, .form-footer { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.eyebrow { margin-bottom: 4px; color: var(--accent); font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.sidebar-heading h1, .inquiry-header h2 { font-size: 22px; line-height: 1.25; }
.thread-count, .material-count { display: grid; min-width: 24px; height: 24px; place-items: center; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 12px; font-weight: 700; }
.sidebar-description { margin: 10px 0 18px; color: var(--text-secondary); font-size: 13px; line-height: 1.55; }
.new-thread-card { display: flex; flex-direction: column; gap: 8px; padding: 14px; border: 1px solid var(--border-color); border-radius: var(--radius-lg); background: var(--bg-surface); }
.new-thread-card label, .thread-form label > span { color: var(--text-secondary); font-size: 12px; font-weight: 600; }
.form-input { width: 100%; padding: 9px 11px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-primary); color: var(--text-primary); resize: vertical; }
.form-input:focus { outline: none; border-color: var(--border-active); }
.compact-textarea { resize: vertical; }
.thread-list { display: flex; flex-direction: column; gap: 5px; margin-top: 18px; }
.thread-item { width: 100%; padding: 10px; border: 1px solid transparent; border-radius: var(--radius-md); background: transparent; color: var(--text-secondary); text-align: left; }
.thread-item:hover { background: var(--bg-surface-hover); }
.thread-item.active { border-color: var(--border-active); background: var(--accent-soft); color: var(--text-primary); }
.thread-item strong, .thread-item span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.thread-item strong { font-size: 13px; }
.thread-item span { margin-top: 3px; color: var(--text-muted); font-size: 11px; }
.inquiry-main { flex: 1; overflow-y: auto; padding: 30px clamp(24px, 5vw, 72px) 56px; }
.inquiry-header { max-width: 920px; margin: 0 auto 22px; }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.danger-action { color: var(--danger); }
.thread-form, .materials-section, .reflection-card { max-width: 920px; margin: 0 auto 20px; padding: 20px; border: 1px solid var(--border-color); border-radius: var(--radius-lg); background: var(--bg-surface); }
.thread-form { display: flex; flex-direction: column; gap: 16px; }
.thread-form label { display: flex; flex-direction: column; gap: 7px; }
.form-footer { align-items: center; color: var(--text-muted); font-size: 12px; }
.section-heading h3, .reflection-card h3 { font-size: 16px; }
.section-heading p, .reflection-card p { margin-top: 4px; color: var(--text-secondary); font-size: 12px; }
.source-list { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.source-card { display: flex; gap: 12px; align-items: flex-start; padding: 13px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-primary); }
.empty-glyph { color: var(--text-muted); }
.source-role { min-width: 104px; color: var(--accent); font-size: 12px; font-weight: 600; }
.source-body { min-width: 0; flex: 1; }
.source-title { max-width: 100%; padding: 0; background: none; color: var(--text-primary); font-size: 14px; font-weight: 600; text-align: left; }
.source-title:hover { color: var(--accent); }
.source-note { margin-top: 4px; color: var(--text-secondary); font-size: 13px; white-space: pre-wrap; }
.source-meta { display: block; margin-top: 6px; color: var(--text-muted); font-size: 11px; }
.remove-source { padding: 0 4px; background: none; color: var(--text-muted); font-size: 20px; line-height: 1; }
.remove-source:hover { color: var(--danger); }
.materials-empty { margin-top: 16px; padding: 28px; border: 1px dashed var(--border-color); border-radius: var(--radius-md); color: var(--text-muted); text-align: center; }
.materials-empty span { display: block; margin-bottom: 8px; font-size: 28px; }
.materials-empty p { max-width: 420px; margin: 0 auto; font-size: 13px; }
.reflection-card { display: grid; gap: 12px; }
.reflection-card .btn { justify-self: start; }
.service-hint { color: var(--warning) !important; }
.inquiry-empty { display: grid; flex: 1; place-content: center; max-width: 540px; padding: 24px; color: var(--text-secondary); text-align: center; }
.inquiry-empty span { font-size: 44px; }
.inquiry-empty h2 { margin: 12px 0 6px; color: var(--text-primary); font-size: 20px; }
.inquiry-empty p { line-height: 1.7; }
.toast { position: fixed; bottom: 28px; left: 50%; z-index: 200; transform: translateX(-50%); padding: 10px 16px; border-radius: var(--radius-md); background: var(--bg-elevated); box-shadow: var(--shadow-lg); color: var(--text-primary); }
.toast-enter-active, .toast-leave-active { transition: opacity .18s, transform .18s; }.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 8px); }
@media (max-width: 820px) { .inquiry-sidebar { width: 240px; min-width: 240px; }.inquiry-main { padding: 24px; }.source-card { flex-wrap: wrap; }.source-role { min-width: auto; }.header-actions { justify-content: flex-start; } }
</style>
