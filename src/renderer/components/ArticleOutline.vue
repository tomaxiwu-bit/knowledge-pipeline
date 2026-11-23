<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import AppIcon from '@/renderer/components/AppIcon.vue'

const props = defineProps<{
  content: string
}>()

interface Heading {
  id: string
  level: number
  text: string
}

const headings = ref<Heading[]>([])
const activeId = ref<string>('')

function extractHeadings() {
  if (!props.content) {
    headings.value = []
    return
  }
  // 从渲染后的 DOM 提取标题
  nextTick(() => {
    const container = document.querySelector('.article-content')
    if (!container) {
      headings.value = []
      return
    }
    const els = container.querySelectorAll('h1, h2, h3, h4')
    const list: Heading[] = []
    els.forEach((el, idx) => {
      const level = parseInt(el.tagName.substring(1))
      const text = el.textContent?.trim() ?? ''
      if (!text) return
      // 给标题加 id 以便跳转
      const id = `heading-${idx}`
      el.id = id
      list.push({ id, level, text })
    })
    headings.value = list
    if (list.length > 0) activeId.value = list[0].id
  })
}

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    activeId.value = id
  }
}

function onScroll() {
  // 滚动时高亮当前标题
  const container = document.querySelector('.reader-article')
  if (!container || headings.value.length === 0) return
  const scrollTop = container.scrollTop
  let current = headings.value[0]?.id ?? ''
  for (const h of headings.value) {
    const el = document.getElementById(h.id)
    if (el && el.offsetTop - 80 <= scrollTop) {
      current = h.id
    }
  }
  activeId.value = current
}

watch(() => props.content, () => {
  extractHeadings()
}, { immediate: false })

onMounted(() => {
  extractHeadings()
  const container = document.querySelector('.reader-article')
  container?.addEventListener('scroll', onScroll)
})

onUnmounted(() => {
  const container = document.querySelector('.reader-article')
  container?.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <aside v-if="headings.length > 0" class="article-outline">
    <div class="outline-header">
      <span class="outline-icon"><AppIcon name="list" :size="13" /></span>
      <span class="outline-title">目录</span>
    </div>
    <nav class="outline-nav">
      <button
        v-for="h in headings"
        :key="h.id"
        class="outline-item"
        :class="{ active: activeId === h.id }"
        :style="{ paddingLeft: 12 + (h.level - 1) * 12 + 'px' }"
        @click="scrollTo(h.id)"
        :title="h.text"
      >
        {{ h.text }}
      </button>
    </nav>
  </aside>
</template>

<style scoped>
.article-outline {
  width: 220px;
  min-width: 220px;
  border-left: 1px solid var(--border-color);
  background: var(--bg-secondary);
  overflow-y: auto;
  padding: 16px 0;
  position: sticky;
  top: 0;
  height: 100%;
}

.outline-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.outline-icon {
  font-size: 14px;
}

.outline-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 8px;
}

.outline-item {
  display: block;
  text-align: left;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.4;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.15s;
  border-left: 2px solid transparent;
}

.outline-item:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.outline-item.active {
  background: var(--accent-soft);
  color: var(--accent);
  border-left-color: var(--accent);
  font-weight: 500;
}
</style>
