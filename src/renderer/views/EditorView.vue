<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import DOMPurify from 'dompurify'
import { useSettingsStore } from '@/renderer/stores/settings'
import { useTemplateStore } from '@/renderer/stores/templates'
import { renderMarkdown, renderAsyncContent } from '@/lib/markdown'
import { exportAsMarkdown, exportAsHTML } from '@/lib/export'
import TemplatePicker from '@/renderer/components/TemplatePicker.vue'
import type { Memo, MemoClient } from '@/services/types'

const settingsStore = useSettingsStore()
const tplStore = useTemplateStore()

const editorContent = ref('# 新文章\n\n开始写作...\n\n')
const memos = ref<Memo[]>([])
const showInsertPanel = ref(false)
const showTemplatePicker = ref(false)
const savedStatus = ref('')
const editorTextarea = ref<HTMLTextAreaElement | null>(null)

function getMemoClient(): MemoClient | null {
  return settingsStore.getClientByKind('memo') as MemoClient | null
}

const renderedPreview = computed(() => {
  if (!editorContent.value) return ''
  const html = renderMarkdown(editorContent.value)
  return DOMPurify.sanitize(html, { ADD_TAGS: ['mark', 'div', 'span'], ADD_ATTR: ['data-math'] })
})

const previewRef = ref<HTMLElement | null>(null)
watch(renderedPreview, async () => {
  await nextTick()
  await renderAsyncContent(previewRef.value)
})

async function loadMemos() {
  const client = getMemoClient()
  if (client && client.isConfigured()) {
    memos.value = await client.getMemos(30)
  }
}

function insertMemo(memo: Memo) {
  const quote = `> ${memo.content.split('\n').join('\n> ')}\n\n`
  const textarea = editorTextarea.value
  if (textarea) {
    // 在光标位置插入引用，而非简单追加到末尾
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const before = editorContent.value.substring(0, start)
    const after = editorContent.value.substring(end)
    editorContent.value = before + quote + after
    // 将光标移到插入内容之后
    nextTick(() => {
      const pos = start + quote.length
      textarea.focus()
      textarea.setSelectionRange(pos, pos)
    })
  } else {
    editorContent.value = editorContent.value + quote
  }
  showInsertPanel.value = false
}

async function saveAsMemo() {
  if (!editorContent.value.trim()) return
  const client = getMemoClient()
  if (!client) {
    savedStatus.value = '未配置笔记服务'
    setTimeout(() => (savedStatus.value = ''), 3000)
    return
  }
  const result = await client.createMemo(editorContent.value)
  if (result) {
    savedStatus.value = '已保存到笔记'
    setTimeout(() => (savedStatus.value = ''), 3000)
  } else {
    savedStatus.value = '保存失败'
    setTimeout(() => (savedStatus.value = ''), 3000)
  }
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(editorContent.value)
    savedStatus.value = '已复制到剪贴板'
    setTimeout(() => (savedStatus.value = ''), 3000)
  } catch {}
}

function insertFormatting(type: string) {
  const textarea = editorTextarea.value
  if (!textarea) return
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = editorContent.value.substring(start, end)
  let insert = selected
  switch (type) {
    case 'bold':
      insert = `**${selected || '粗体'}**`
      break
    case 'italic':
      insert = `*${selected || '斜体'}*`
      break
    case 'h1':
      insert = `# ${selected || '标题'}`
      break
    case 'h2':
      insert = `## ${selected || '标题'}`
      break
    case 'link':
      insert = `[${selected || '链接文字'}](url)`
      break
    case 'code':
      insert = `\`${selected || '代码'}\``
      break
    case 'quote':
      insert = `> ${selected || '引用'}`
      break
  }
  editorContent.value =
    editorContent.value.substring(0, start) + insert + editorContent.value.substring(end)
}

function applyTemplate(content: string) {
  editorContent.value = content
  // 聚焦编辑器，将光标定位到 {{cursor}} 标记处（已替换为空）
  setTimeout(() => {
    const textarea = editorTextarea.value
    if (!textarea) return
    const cursorPos = editorContent.value.indexOf('', 0)
    // 查找模板中可能残留的"光标位置"标记
    const marker = editorContent.value.indexOf('{{cursor}}')
    if (marker >= 0) {
      editorContent.value = editorContent.value.replace('{{cursor}}', '')
      textarea.focus()
      textarea.setSelectionRange(marker, marker)
    } else {
      textarea.focus()
      const end = editorContent.value.length
      textarea.setSelectionRange(end, end)
    }
  }, 50)
}

function openTemplatePicker() {
  showTemplatePicker.value = true
}

// 导出
function exportMarkdown() {
  if (!editorContent.value.trim()) return
  // 从第一行提取标题
  const titleMatch = editorContent.value.match(/^#\s+(.+)/)
  const title = titleMatch ? titleMatch[1] : '新文章'
  exportAsMarkdown(editorContent.value, {
    title,
    source: 'editor',
    createdAt: new Date().toISOString()
  })
  savedStatus.value = '已导出 Markdown'
  setTimeout(() => (savedStatus.value = ''), 3000)
}

function exportHTML() {
  if (!editorContent.value.trim()) return
  const titleMatch = editorContent.value.match(/^#\s+(.+)/)
  const title = titleMatch ? titleMatch[1] : '新文章'
  exportAsHTML(editorContent.value, {
    title,
    source: 'editor',
    createdAt: new Date().toISOString()
  })
  savedStatus.value = '已导出 HTML'
  setTimeout(() => (savedStatus.value = ''), 3000)
}

onMounted(async () => {
  await settingsStore.load()
  await loadMemos()
  window.addEventListener('kp:open-template', openTemplatePicker)
})

onUnmounted(() => {
  window.removeEventListener('kp:open-template', openTemplatePicker)
})
</script>

<template>
  <div class="editor-view">
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <button class="format-btn" @click="openTemplatePicker" title="从模板新建">📋</button>
        <button class="format-btn" @click="insertFormatting('h1')" title="标题1">H1</button>
        <button class="format-btn" @click="insertFormatting('h2')" title="标题2">H2</button>
        <button class="format-btn" @click="insertFormatting('bold')" title="粗体">B</button>
        <button class="format-btn" @click="insertFormatting('italic')" title="斜体">I</button>
        <button class="format-btn" @click="insertFormatting('quote')" title="引用">"</button>
        <button class="format-btn" @click="insertFormatting('code')" title="代码">&lt;/&gt;</button>
        <button class="format-btn" @click="insertFormatting('link')" title="链接">🔗</button>
      </div>
      <div class="toolbar-right">
        <span v-if="savedStatus" class="saved-status">{{ savedStatus }}</span>
        <button class="btn btn-secondary" @click="showInsertPanel = !showInsertPanel">
          📝 引用笔记
        </button>
        <button class="btn btn-secondary" @click="exportMarkdown" title="导出 Markdown">📄 .md</button>
        <button class="btn btn-secondary" @click="exportHTML" title="导出 HTML">🌐 .html</button>
        <button class="btn btn-secondary" @click="copyToClipboard">复制</button>
        <button class="btn btn-primary" @click="saveAsMemo">存到 Memos</button>
      </div>
    </div>

    <div class="editor-body">
      <div class="editor-pane">
        <textarea
          ref="editorTextarea"
          v-model="editorContent"
          class="editor-textarea"
          placeholder="开始写作..."
          spellcheck="false"
        ></textarea>
      </div>

      <div class="preview-pane">
        <div ref="previewRef" class="preview-content" v-html="renderedPreview"></div>
      </div>
    </div>

    <div v-if="showInsertPanel" class="insert-panel">
      <div class="insert-header">
        <h3>选择要引用的笔记</h3>
        <button class="btn btn-secondary" @click="showInsertPanel = false">关闭</button>
      </div>
      <div class="insert-list">
        <div
          v-for="memo in memos"
          :key="memo.id"
          class="insert-item"
          @click="insertMemo(memo)"
        >
          <p class="insert-item-content">{{ memo.content }}</p>
          <span class="insert-item-date">{{ new Date(memo.createdAt).toLocaleDateString('zh-CN') }}</span>
        </div>
        <div v-if="memos.length === 0" class="empty-state">
          <p>暂无可引用的笔记</p>
        </div>
      </div>
    </div>

    <TemplatePicker
      :visible="showTemplatePicker"
      @close="showTemplatePicker = false"
      @apply="applyTemplate"
    />
  </div>
</template>

<style scoped>
.editor-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-left {
  display: flex;
  gap: 4px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.format-btn {
  background: transparent;
  color: var(--text-secondary);
  padding: 6px 10px;
  font-size: 13px;
  border-radius: var(--radius-sm);
  min-width: 32px;
}

.format-btn:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.saved-status {
  font-size: 12px;
  color: var(--success);
}

.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.editor-pane {
  flex: 1;
  border-right: 1px solid var(--border-color);
}

.editor-textarea {
  width: 100%;
  height: 100%;
  background: var(--bg-primary);
  border: none;
  padding: 24px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.8;
  resize: none;
  outline: none;
}

.preview-pane {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
}

.preview-content {
  font-size: 15px;
  line-height: 1.8;
}

.preview-content :deep(h1) {
  font-size: 24px;
  font-weight: 700;
  margin: 24px 0 12px;
}

.preview-content :deep(h2) {
  font-size: 20px;
  font-weight: 600;
  margin: 20px 0 10px;
}

.preview-content :deep(p) {
  margin-bottom: 16px;
}

.preview-content :deep(code) {
  background: var(--bg-surface);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
}

.preview-content :deep(pre) {
  background: var(--bg-surface);
  padding: 16px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin: 16px 0;
}

.preview-content :deep(blockquote) {
  border-left: 3px solid var(--accent);
  padding-left: 16px;
  margin: 16px 0;
  color: var(--text-secondary);
}

.insert-panel {
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 400px;
  max-height: 400px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  z-index: 50;
}

.insert-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.insert-header h3 {
  font-size: 14px;
  font-weight: 600;
}

.insert-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.insert-item {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
}

.insert-item:hover {
  background: var(--bg-surface-hover);
}

.insert-item-content {
  font-size: 13px;
  margin-bottom: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.insert-item-date {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
