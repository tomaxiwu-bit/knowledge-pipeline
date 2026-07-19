import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCommandRegistry } from '@/renderer/composables/useCommandRegistry'

export function useKeyboardShortcuts() {
  const router = useRouter()
  const { togglePalette } = useCommandRegistry()

  function isEditableTarget(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement
    if (!t) return false
    const tag = t.tagName.toLowerCase()
    return tag === 'input' || tag === 'textarea' || t.isContentEditable
  }

  function onKeydown(e: KeyboardEvent) {
    // Esc 始终生效：返回上一页或关闭面板
    if (e.key === 'Escape') {
      const { paletteVisible, closePalette } = useCommandRegistry()
      if (paletteVisible.value) {
        closePalette()
        e.preventDefault()
        return
      }
      if (!isEditableTarget(e) || (e.target as HTMLElement)?.tagName?.toLowerCase() !== 'input') {
        const route = router.currentRoute.value
        if (route.name !== 'home') {
          router.back()
          e.preventDefault()
        }
      }
      return
    }

    if (!e.ctrlKey && !e.metaKey) return
    // 输入框内只放行特定组合
    const editable = isEditableTarget(e)

    const key = e.key.toLowerCase()
    // Ctrl/Cmd + K：切换命令面板（全局，输入框也响应）
    if (key === 'k') {
      e.preventDefault()
      togglePalette()
      return
    }

    // Ctrl/Cmd + D：跳转今日笔记
    if (key === 'd') {
      e.preventDefault()
      router.push('/daily')
      return
    }

    if (editable) return

    // 数字键切换页面
    if (['1', '2', '3', '4', '5'].includes(key)) {
      e.preventDefault()
      const map: Record<string, string> = {
        '1': '/',
        '2': '/search',
        '3': '/editor',
        '4': '/settings',
        '5': '/graph'
      }
      router.push(map[key])
      return
    }

    // Ctrl/Cmd + N：新建笔记
    if (key === 'n') {
      e.preventDefault()
      const route = router.currentRoute.value
      if (route.name === 'home') {
        window.dispatchEvent(new CustomEvent('kp:new-memo'))
      } else {
        router.push('/')
        setTimeout(() => window.dispatchEvent(new CustomEvent('kp:new-memo')), 200)
      }
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
  })
}
