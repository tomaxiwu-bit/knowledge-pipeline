<script setup lang="ts">
// 模板选择器
// 借鉴 Obsidian 的模板插入流程：命令面板 → 选择模板 → 变量替换 → 插入编辑器

import { ref, computed } from 'vue'
import { useTemplateStore, type Template } from '@/renderer/stores/templates'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  apply: [content: string]
}>()

const tplStore = useTemplateStore()
const selectedTemplate = ref<Template | null>(null)
const customVars = ref<Record<string, string>>({})

const categoryLabel: Record<Template['category'], string> = {
  daily: '每日',
  reading: '阅读',
  meeting: '会议',
  rss: 'RSS',
  custom: '自定义'
}

const varsList = computed(() => {
  if (!selectedTemplate.value) return []
  // 从模板正文中提取 {{var}} 变量
  const matches = selectedTemplate.value.body.matchAll(/\{\{(\w+)\}\}/g)
  const vars = new Set<string>()
  for (const m of matches) {
    const name = m[1]
    // cursor 是光标占位，date/time 自动填充，不展示
    if (name !== 'cursor' && name !== 'date' && name !== 'time') {
      vars.add(name)
    }
  }
  return Array.from(vars)
})

function selectTemplate(tpl: Template) {
  selectedTemplate.value = tpl
  customVars.value = {}
}

function applyTemplate() {
  if (!selectedTemplate.value) return
  const content = tplStore.applyTemplate(selectedTemplate.value, customVars.value)
  emit('apply', content)
  selectedTemplate.value = null
  emit('close')
}

function back() {
  selectedTemplate.value = null
}
</script>

<template>
  <transition name="picker-fade">
    <div v-if="visible" class="picker-overlay" @click.self="emit('close')">
      <div class="picker-panel">
        <!-- 模板列表 -->
        <div v-if="!selectedTemplate" class="picker-list">
          <div class="picker-header">
            <h2>📋 选择模板</h2>
            <button class="btn btn-secondary btn-sm" @click="emit('close')">✕</button>
          </div>
          <div class="template-grid">
            <button
              v-for="tpl in tplStore.allTemplates"
              :key="tpl.id"
              class="template-card"
              @click="selectTemplate(tpl)"
            >
              <span class="tpl-icon">{{ tpl.icon }}</span>
              <span class="tpl-name">{{ tpl.name }}</span>
              <span class="tpl-category">{{ categoryLabel[tpl.category] }}</span>
            </button>
          </div>
        </div>

        <!-- 变量填充 + 预览 -->
        <div v-else class="picker-detail">
          <div class="picker-header">
            <button class="btn btn-secondary btn-sm" @click="back">← 返回</button>
            <h2>{{ selectedTemplate.icon }} {{ selectedTemplate.name }}</h2>
          </div>

          <div v-if="varsList.length > 0" class="vars-section">
            <h3 class="section-title">变量填充</h3>
            <div v-for="v in varsList" :key="v" class="var-row">
              <label class="var-label">{{ v }}</label>
              <input
                v-model="customVars[v]"
                type="text"
                :placeholder="`输入 ${v}（可留空）`"
                class="var-input"
              />
            </div>
          </div>

          <div class="preview-section">
            <h3 class="section-title">预览</h3>
            <pre class="preview-box">{{ tplStore.applyTemplate(selectedTemplate, customVars) }}</pre>
          </div>

          <div class="picker-actions">
            <button class="btn btn-secondary" @click="back">取消</button>
            <button class="btn btn-primary" @click="applyTemplate">
              插入模板
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.picker-panel {
  width: 560px;
  max-width: 90%;
  max-height: 80vh;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.picker-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.picker-header h2 {
  font-size: 18px;
  font-weight: 600;
  flex: 1;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 20px;
  overflow-y: auto;
}

.template-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s;
}

.template-card:hover {
  border-color: var(--border-active);
  background: var(--bg-surface-hover);
  transform: translateY(-1px);
}

.tpl-icon {
  font-size: 28px;
}

.tpl-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.tpl-category {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 999px;
}

/* 详情 */
.picker-detail {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.vars-section,
.preview-section {
  padding: 16px 20px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 10px;
}

.var-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.var-label {
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 80px;
  font-family: var(--font-mono);
}

.var-input {
  flex: 1;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  color: var(--text-primary);
  font-size: 14px;
}

.var-input:focus {
  outline: none;
  border-color: var(--border-active);
}

.preview-box {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  max-height: 240px;
  overflow-y: auto;
}

.picker-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.picker-fade-enter-active,
.picker-fade-leave-active {
  transition: opacity 0.15s;
}

.picker-fade-enter-from,
.picker-fade-leave-to {
  opacity: 0;
}
</style>
