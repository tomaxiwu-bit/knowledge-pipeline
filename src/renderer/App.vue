<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/renderer/stores/settings'
import { useRelationStore } from '@/renderer/stores/relations'
import { useTagStore } from '@/renderer/stores/tags'
import { useSavedSearchStore } from '@/renderer/stores/savedSearches'
import { useTemplateStore } from '@/renderer/stores/templates'
import { useInquiryThreadStore } from '@/renderer/stores/inquiryThreads'
import { useCommandRegistry } from '@/renderer/composables/useCommandRegistry'
import { useKeyboardShortcuts } from '@/renderer/composables/useKeyboardShortcuts'
import SidebarNav from '@/renderer/components/SidebarNav.vue'
import CommandPalette from '@/renderer/components/CommandPalette.vue'

const settingsStore = useSettingsStore()
const relationStore = useRelationStore()
const tagStore = useTagStore()
const savedSearchStore = useSavedSearchStore()
const templateStore = useTemplateStore()
const inquiryThreadStore = useInquiryThreadStore()
const router = useRouter()
const { registerAll, paletteVisible, closePalette } = useCommandRegistry()

useKeyboardShortcuts()

// 注册默认命令集
registerAll([
  {
    id: 'nav-home',
    title: '流水线首页',
    icon: '🏠',
    description: '查看 RSS、收藏、笔记三栏',
    keywords: 'home dashboard 流水线 首页',
    category: 'navigate',
    shortcut: 'Ctrl+1',
    handler: () => router.push('/')
  },
  {
    id: 'nav-search',
    title: '全局搜索',
    icon: '🔍',
    description: '搜索 RSS 文章、收藏、笔记',
    keywords: 'search find 搜索 查找',
    category: 'navigate',
    shortcut: 'Ctrl+2',
    handler: () => router.push('/search')
  },
  {
    id: 'nav-editor',
    title: 'Markdown 写作',
    icon: '✏️',
    description: '打开 Markdown 编辑器',
    keywords: 'editor write 写作 编辑',
    category: 'navigate',
    shortcut: 'Ctrl+3',
    handler: () => router.push('/editor')
  },
  {
    id: 'nav-settings',
    title: '设置',
    icon: '⚙️',
    description: '管理后端、主题、快捷键',
    keywords: 'settings config 设置 配置',
    category: 'settings',
    shortcut: 'Ctrl+4',
    handler: () => router.push('/settings')
  },
  {
    id: 'nav-daily',
    title: '今日笔记',
    icon: '📅',
    description: '打开今天的每日笔记',
    keywords: 'daily journal today 今日 每日 日记',
    category: 'navigate',
    shortcut: 'Ctrl+D',
    handler: () => router.push('/daily')
  },
  {
    id: 'nav-graph',
    title: '知识图谱',
    icon: '🕸️',
    description: '可视化条目间的关系网络',
    keywords: 'graph network relation 知识 图谱 关系 网络',
    category: 'navigate',
    handler: () => router.push('/graph')
  },
  {
    id: 'nav-inquiry',
    title: '探究线',
    icon: '🧭',
    description: '围绕一个问题组织证据、判断与下一步',
    keywords: 'inquiry question evidence research 探究 问题 证据 简报',
    category: 'navigate',
    handler: () => router.push('/inquiry')
  },
  {
    id: 'create-memo',
    title: '新建速记',
    icon: '📝',
    description: '在首页创建一条新笔记',
    keywords: 'new memo note 笔记 速记 新建',
    category: 'create',
    shortcut: 'Ctrl+N',
    handler: () => {
      const route = router.currentRoute.value
      if (route.name === 'home') {
        window.dispatchEvent(new CustomEvent('kp:new-memo'))
      } else {
        router.push('/')
        setTimeout(() => window.dispatchEvent(new CustomEvent('kp:new-memo')), 200)
      }
    }
  },
  {
    id: 'toggle-theme',
    title: '切换主题',
    icon: '🎨',
    description: '在亮色和暗色之间切换',
    keywords: 'theme dark light 主题 暗色 亮色',
    category: 'settings',
    handler: () => settingsStore.toggleTheme()
  },
  {
    id: 'read-later',
    title: '添加稍后读',
    icon: '⏰',
    description: '添加一个稍后阅读的链接',
    keywords: 'read later bookmark 稍后 读 收藏',
    category: 'create',
    handler: () => {
      router.push('/')
      setTimeout(() => window.dispatchEvent(new CustomEvent('kp:open-read-later')), 300)
    }
  },
  {
    id: 'insert-template',
    title: '从模板新建',
    icon: '📋',
    description: '在编辑器中插入模板',
    keywords: 'template insert 模板 插入',
    category: 'create',
    handler: () => {
      router.push('/editor')
      setTimeout(() => window.dispatchEvent(new CustomEvent('kp:open-template')), 300)
    }
  },
  {
    id: 'save-search',
    title: '保存当前搜索',
    icon: '💾',
    description: '将搜索条件保存为智能集合',
    keywords: 'save search smart collection 保存 搜索 智能集合',
    category: 'action',
    handler: () => {
      router.push('/search')
      setTimeout(() => window.dispatchEvent(new CustomEvent('kp:save-search')), 300)
    }
  }
])

onMounted(async () => {
  // 统一初始化所有 store，保证依赖顺序：
  // settings 必须先加载（其他 store 依赖 client），然后并行加载关系/标签/智能集合
  await settingsStore.load()
  await Promise.all([
    relationStore.load(),
    tagStore.loadAllTags(),
    savedSearchStore.load(),
    templateStore.load(),
    inquiryThreadStore.load()
  ])
})
</script>

<template>
  <div class="app-layout">
    <SidebarNav />
    <main class="app-main">
      <router-view />
    </main>
    <CommandPalette :visible="paletteVisible" @close="closePalette" />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100%;
  width: 100%;
}

.app-main {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
