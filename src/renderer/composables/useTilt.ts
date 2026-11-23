import { onBeforeUnmount, ref } from 'vue'

interface TiltOptions {
  /** 最大旋转角度，单位度。桌面工具里 2° 已经很明显了 */
  max?: number
  /** 离开时的回落时长，毫秒 */
  settle?: number
}

/**
 * 指针跟随的轻微 3D 倾斜。
 * 只移动 ±max 度、只改 transform，不改布局，也不动任何文字位置。
 */
export function useTilt(options: TiltOptions = {}) {
  const max = options.max ?? 2
  const settle = options.settle ?? 420
  const el = ref<HTMLElement | null>(null)
  const style = ref<Record<string, string>>({})
  let frameId = 0

  function onMove(event: MouseEvent): void {
    const node = el.value
    if (!node) return
    const rect = node.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const px = (event.clientX - rect.left) / rect.width - 0.5
    const py = (event.clientY - rect.top) / rect.height - 0.5
    cancelAnimationFrame(frameId)
    frameId = requestAnimationFrame(() => {
      style.value = {
        transform: `perspective(1400px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`,
        transition: 'transform 110ms ease-out'
      }
    })
  }

  function onLeave(): void {
    cancelAnimationFrame(frameId)
    style.value = {
      transform: 'perspective(1400px) rotateX(0deg) rotateY(0deg)',
      transition: `transform ${settle}ms cubic-bezier(0.16, 1, 0.3, 1)`
    }
  }

  onBeforeUnmount(() => {
    cancelAnimationFrame(frameId)
  })

  return { el, style, onMove, onLeave }
}
