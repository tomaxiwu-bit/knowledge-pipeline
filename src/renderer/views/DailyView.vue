<script setup lang="ts">
// 每日笔记视图
// 借鉴 Logseq 的 daily journal 设计：按日期组织笔记，支持日期导航和快速记录
// 与现有 Memos 后端整合，按 createdAt 过滤当天笔记

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/renderer/stores/settings'
import type { Memo, MemoClient } from '@/services/types'

const router = useRouter()
const settingsStore = useSettingsStore()

const selectedDate = ref(new Date())
const items = ref<Memo[]>([])
const loading = ref(false)
const error = ref('')
const newMemoContent = ref('')
const showInput = ref(false)

function getClient(): MemoClient | null {
  return settingsStore.getClientByKind('memo') as MemoClient | null
}

// 日期工具
function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDisplay(d: Date): string {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  
  let relative = ''
  if (diff === 0) relative = '今天'
  else if (diff === -1) relative = '昨天'
  else if (diff === 1) relative = '明天'
  else if (diff < 0) relative = `${Math.abs(diff)} 天前`
  else relative = `${diff} 天后`
  
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]} · ${relative}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function isToday(d: Date): boolean {
  return isSameDay(d, new Date())
}

function goPrevDay() {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() - 1)
  selectedDate.value = d
  loadItems()
}

function goNextDay() {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() + 1)
  selectedDate.value = d
  loadItems()
}

function goToday() {
  selectedDate.value = new Date()
  loadItems()
}

function onDateChange(e: Event) {
  const val = (e.target as HTMLInputElement).value
  if (val) {
    selectedDate.value = new Date(val + 'T00:00:00')
    loadItems()
  }
}

// 过滤当天的笔记
async function loadItems() {
  const client = getClient()
  if (!client || !client.isConfigured()) {
    error.value = '未配置笔记服务，请前往设置页'
    items.value = []
    return
  }
  loading.value = true
  error.value = ''
  try {
    // 拉取较多笔记后客户端过滤当天
    const all = await client.getMemos(200)
    items.value = all.filter((m) => isSameDay(new Date(m.createdAt), selectedDate.value))
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function createMemo() {
  if (!newMemoContent.value.trim()) return
  const client = getClient()
  if (!client) return
  const memo = await client.createMemo(newMemoContent.value)
  if (memo) {
    items.value.unshift(memo)
    newMemoContent.value = ''
    showInput.value = false
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const isEmpty = computed(() => items.value.length === 0 && !loading.value && !error.value)

// 最近 7 天快捷跳转
const recentDays = computed(() => {
  const days: { date: Date; label: string; count: number }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const count = items.value.length // 只对当天显示
    let label = ''
    if (i === 0) label = '今天'
    else if (i === 1) label = '昨天'
    else label = `${d.getMonth() + 1}/${d.getDate()}`
    days.push({ date: d, label, count: isSameDay(d, selectedDate.value) ? count : 0 })
  }
  return days
})

onMounted(async () => {
  await settingsStore.load()
  await loadItems()
})
</script>

<template>
  <div class="daily-view">
    <div class="daily-header">
      <button class="btn btn-secondary" @click="router.back()">← 返回</button>
      <div class="date-nav">
        <button class="btn btn-secondary btn-sm" @click="goPrevDay" title="前一天">‹</button>
        <input
          type="date"
          :value="formatDate(selectedDate)"
          @change="onDateChange"
          class="date-picker"
        />
        <button class="btn btn-secondary btn-sm" @click="goNextDay" title="后一天">›</button>
        <button v-if="!isToday(selectedDate)" class="btn btn-secondary btn-sm" @click="goToday">
          回到今天
        </button>
      </div>
    </div>

    <div class="daily-body">
      <div class="daily-content">
        <div class="date-display">
          <h1 class="date-title">{{ formatDisplay(selectedDate) }}</h1>
          <button class="btn btn-primary" @click="showInput = !showInput">
            {{ showInput ? '取消' : '✍️ 记一笔' }}
          </button>
        </div>

        <div v-if="showInput" class="quick-input-area">
          <textarea
            v-model="newMemoContent"
            class="quick-input"
            placeholder="今天记点什么... 支持 #标签"
            rows="4"
            autofocus
            @keydown.ctrl.enter="createMemo"
          ></textarea>
          <div class="input-actions">
            <span class="input-hint">Ctrl + Enter 快速保存</span>
            <button class="btn btn-primary" @click="createMemo" :disabled="!newMemoContent.trim()">
              保存
            </button>
          </div>
        </div>

        <div v-if="loading" class="daily-loading">
          <p>加载中...</p>
        </div>

        <div v-if="error" class="daily-error">
          <span class="error-icon">⚠️</span>
          <p>{{ error }}</p>
          <button class="btn btn-primary" @click="router.push('/settings')">去配置</button>
        </div>

        <div v-if="isEmpty" class="daily-empty">
          <span class="empty-icon">📅</span>
          <p>这一天还没有笔记</p>
          <button class="btn btn-primary" @click="showInput = true">开始记录</button>
        </div>

        <div v-if="items.length > 0" class="memo-timeline">
          <div v-for="memo in items" :key="memo.id" class="timeline-item">
            <div class="timeline-time">{{ formatTime(memo.createdAt) }}</div>
            <div class="timeline-content">
              <div class="memo-text">{{ memo.content }}</div>
              <div v-if="memo.tags.length > 0" class="memo-tags">
                <span v-for="tag in memo.tags" :key="tag" class="tag">{{ tag }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：最近日期快捷跳转 -->
      <aside class="daily-sidebar">
        <h3 class="sidebar-title">最近 7 天</h3>
        <div class="day-list">
          <button
            v-for="day in recentDays"
            :key="day.label"
            class="day-item"
            :class="{ active: isSameDay(day.date, selectedDate) }"
            @click="selectedDate = day.date; loadItems()"
          >
            <span class="day-label">{{ day.label }}</span>
            <span class="day-date">{{ day.date.getMonth() + 1 }}/{{ day.date.getDate() }}</span>
            <span v-if="day.count > 0" class="day-count">{{ day.count }}</span>
          </button>
        </div>

        <div class="daily-stats">
          <h3 class="sidebar-title">今日统计</h3>
          <div class="stat-row">
            <span class="stat-label">笔记数</span>
            <span class="stat-value">{{ items.length }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">标签数</span>
            <span class="stat-value">{{ new Set(items.flatMap(m => m.tags)).size }}</span>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.daily-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.daily-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  gap: 12px;
}

.date-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.date-picker {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 6px 10px;
  color: var(--text-primary);
  font-size: 14px;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 13px;
}

.daily-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.daily-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px 64px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.date-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.date-title {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
}

.quick-input-area {
  background: var(--bg-surface);
  border: 1px solid var(--border-active);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 24px;
}

.quick-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 15px;
  line-height: 1.7;
  resize: vertical;
  min-height: 80px;
  font-family: var(--font-sans);
}

.quick-input::placeholder {
  color: var(--text-muted);
}

.input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.input-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.daily-loading,
.daily-error,
.daily-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 20px;
  color: var(--text-muted);
  text-align: center;
  gap: 8px;
}

.error-icon,
.empty-icon {
  font-size: 40px;
}

.memo-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.timeline-item {
  display: flex;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color);
}

.timeline-item:last-child {
  border-bottom: none;
}

.timeline-time {
  font-size: 13px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  min-width: 48px;
  padding-top: 2px;
}

.timeline-content {
  flex: 1;
  min-width: 0;
}

.memo-text {
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.memo-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.tag {
  font-size: 12px;
  padding: 2px 8px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 999px;
}

/* 右侧栏 */
.daily-sidebar {
  width: 220px;
  min-width: 220px;
  border-left: 1px solid var(--border-color);
  padding: 20px 16px;
  overflow-y: auto;
}

.sidebar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}

.day-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 32px;
}

.day-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.day-item:hover {
  background: var(--bg-surface-hover);
}

.day-item.active {
  background: var(--accent-soft);
  color: var(--accent);
}

.day-label {
  font-size: 13px;
  font-weight: 500;
  flex: 1;
}

.day-date {
  font-size: 12px;
  color: var(--text-muted);
}

.day-item.active .day-date {
  color: var(--accent);
}

.day-count {
  font-size: 11px;
  padding: 1px 6px;
  background: var(--bg-surface-hover);
  border-radius: 999px;
  color: var(--text-secondary);
}

.daily-stats {
  margin-top: 24px;
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color);
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
</style>
