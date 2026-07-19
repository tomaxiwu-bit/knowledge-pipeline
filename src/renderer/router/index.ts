import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/renderer/views/HomeView.vue')
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('@/renderer/views/SearchView.vue')
    },
    {
      path: '/daily',
      name: 'daily',
      component: () => import('@/renderer/views/DailyView.vue')
    },
    {
      path: '/graph',
      name: 'graph',
      component: () => import('@/renderer/views/GraphView.vue')
    },
    {
      path: '/inquiry',
      name: 'inquiry',
      component: () => import('@/renderer/views/InquiryView.vue')
    },
    {
      path: '/knowledge',
      name: 'knowledge',
      component: () => import('@/renderer/views/KnowledgeView.vue')
    },
    {
      path: '/reader/:source/:id',
      name: 'reader',
      component: () => import('@/renderer/views/ReaderView.vue'),
      props: true
    },
    {
      path: '/editor',
      name: 'editor',
      component: () => import('@/renderer/views/EditorView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/renderer/views/SettingsView.vue')
    }
  ]
})

export default router
