<script setup lang="ts">
/**
 * 全站背景粒子层。
 * 几十个缓慢漂移的微光点，压在 body 渐变之下、内容之上。
 * 只做「氛围」不做「特效」：没有连线、没有拖尾，避免和正文抢注意力。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

interface Particle {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  a: number
  hue: string
}

const canvasRef = ref<HTMLCanvasElement | null>(null)

let ctx: CanvasRenderingContext2D | null = null
let frame = 0
let particles: Particle[] = []
let width = 0
let height = 0
let dpr = 1
let paused = false
let lastPaint = 0
let reduceMotion = false

const PALETTE: Record<string, string[]> = {
  dark: ['90, 169, 255', '124, 200, 255', '168, 190, 255', '120, 232, 216'],
  light: ['37, 99, 235', '59, 130, 246', '6, 182, 212', '124, 92, 255']
}

function themeKey(): string {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

function palette(): string[] {
  return PALETTE[themeKey()] ?? PALETTE.dark
}

function makeParticles(): Particle[] {
  // 按面积给密度，屏幕再大也不会失控
  const count = Math.min(64, Math.max(24, Math.round((width * height) / 42000)))
  const colors = palette()
  const next: Particle[] = []
  for (let i = 0; i < count; i += 1) {
    next.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.7 + Math.random() * 1.0,
      vx: (Math.random() - 0.5) * 7,
      vy: -3 - Math.random() * 7,
      a: 0.2 + Math.random() * 0.28,
      hue: colors[i % colors.length] as string
    })
  }
  return next
}

function resize(elem: HTMLCanvasElement): void {
  const rect = elem.getBoundingClientRect()
  width = rect.width
  height = rect.height
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  elem.width = Math.round(width * dpr)
  elem.height = Math.round(height * dpr)
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  particles = makeParticles()
}

function draw(): void {
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)
  for (const p of particles) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${p.hue}, ${p.a})`
    ctx.fill()
  }
}

function step(now: number): void {
  frame = requestAnimationFrame(step)
  if (paused) return
  // 30fps 就够：粒子是氛围，不需要 60fps 的预算
  if (now - lastPaint < 33) return
  const dt = lastPaint === 0 ? 0.016 : Math.min((now - lastPaint) / 1000, 0.08)
  lastPaint = now

  for (const p of particles) {
    p.x += p.vx * dt
    p.y += p.vy * dt
    if (p.y < -8) {
      p.y = height + 8
      p.x = Math.random() * width
    }
    if (p.x < -8) p.x = width + 8
    if (p.x > width + 8) p.x = -8
  }
  draw()
}

function onVisibility(): void {
  paused = document.hidden
  if (!paused) lastPaint = 0
}

let observer: MutationObserver | null = null
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const elem = canvasRef.value
  if (!elem) return
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ctx = elem.getContext('2d')
  resize(elem)
  draw()

  if (!reduceMotion) {
    frame = requestAnimationFrame(step)
  }

  resizeObserver = new ResizeObserver(() => {
    resize(elem)
    draw()
  })
  resizeObserver.observe(document.body)

  observer = new MutationObserver(() => {
    // 主题切换后重新取色，粒子跟着换色调
    particles = makeParticles()
    draw()
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  observer?.disconnect()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <canvas ref="canvasRef" class="particle-field" aria-hidden="true"></canvas>
</template>

<style scoped>
.particle-field {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  /* 负值：排在普通流内容之下，侧栏和面板会正常压住粒子 */
  z-index: -1;
}
</style>
