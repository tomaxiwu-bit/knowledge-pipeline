<script setup lang="ts">
/**
 * 启动开场：不到一秒的「开机」画面。
 * 点阵 + 扫描线 + 双层旋转弧 + 环形刻度 + 分段载入条，只在这一瞬间出现。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from '@/renderer/components/AppIcon.vue'

const visible = ref(true)
const leaving = ref(false)
const timers: number[] = []
const SEGMENTS = 12

onMounted(() => {
  if ((window as unknown as { __KP_NO_SPLASH__?: boolean }).__KP_NO_SPLASH__) {
    visible.value = false
    return
  }
  timers.push(window.setTimeout(() => { leaving.value = true }, 420))
  timers.push(window.setTimeout(() => { visible.value = false }, 780))
})

onBeforeUnmount(() => {
  timers.forEach((id) => window.clearTimeout(id))
})
</script>

<template>
  <div v-if="visible" class="splash" :class="{ leaving }">
    <div class="splash-grid"></div>
    <div class="splash-glow"></div>
    <div class="splash-scan"></div>

    <div class="splash-core">
      <div class="splash-orbit">
        <span class="orbit ticks"></span>
        <span class="orbit arc-a"></span>
        <span class="orbit arc-b"></span>
        <span class="splash-logo"><AppIcon name="layers" :size="26" /></span>
      </div>

      <h1 class="splash-title">知识流水线</h1>
      <p class="splash-sub">KNOWLEDGE PIPELINE</p>

      <div class="splash-bar">
        <i
          v-for="n in SEGMENTS"
          :key="n"
          :style="{ animationDelay: `${(n - 1) * 26}ms` }"
        ></i>
      </div>

      <p class="splash-status"><span class="pulse"></span>正在建立本地索引</p>
    </div>

    <span class="corner tl"></span>
    <span class="corner tr"></span>
    <span class="corner bl"></span>
    <span class="corner br"></span>
  </div>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--bg-primary);
}

.splash.leaving {
  animation: splash-out 0.34s ease forwards;
}

@keyframes splash-out {
  to {
    opacity: 0;
    transform: scale(1.015);
  }
}

.splash-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle at 1px 1px, var(--grid-line) 1px, transparent 1.4px);
  background-size: 28px 28px;
}

.splash-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(46% 40% at 50% 46%, var(--mesh-a), transparent 72%);
}

.splash-scan {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 300px;
  background: linear-gradient(180deg, transparent, rgba(90, 169, 255, 0.16) 55%, transparent);
  animation: splash-scan 1.1s ease-in-out both;
}

/* 四角定位角标：只在开场出现，给画面一个「仪表」的框 */
.corner {
  position: absolute;
  width: 26px;
  height: 26px;
  border-color: rgba(255, 255, 255, 0.22);
  border-style: solid;
  border-width: 0;
}

.corner.tl {
  top: 34px;
  left: 40px;
  border-top-width: 1px;
  border-left-width: 1px;
}

.corner.tr {
  top: 34px;
  right: 40px;
  border-top-width: 1px;
  border-right-width: 1px;
}

.corner.bl {
  bottom: 34px;
  left: 40px;
  border-bottom-width: 1px;
  border-left-width: 1px;
}

.corner.br {
  bottom: 34px;
  right: 40px;
  border-bottom-width: 1px;
  border-right-width: 1px;
}

@keyframes splash-scan {
  from { transform: translateY(-240px); }
  to { transform: translateY(calc(100vh + 60px)); }
}

.splash-core {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: splash-in 0.42s var(--ease-out-expo) both;
}

@keyframes splash-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* === 标志与外圈 === */

.splash-orbit {
  position: relative;
  width: 112px;
  height: 112px;
  display: grid;
  place-items: center;
  margin-bottom: 22px;
}

.orbit {
  position: absolute;
  border-radius: 50%;
}

.ticks {
  inset: 0;
  background: repeating-conic-gradient(rgba(255, 255, 255, 0.4) 0deg 1deg, transparent 1deg 6deg);
  -webkit-mask: radial-gradient(circle, transparent 0 50px, #000 50px 52px, transparent 52px);
  mask: radial-gradient(circle, transparent 0 50px, #000 50px 52px, transparent 52px);
  animation: orbit-spin 26s linear infinite;
}

.arc-a {
  inset: -5px;
  background: conic-gradient(from 0deg, transparent 0deg, var(--accent) 62deg, transparent 150deg);
  -webkit-mask: radial-gradient(circle, transparent 0 54px, #000 54px 56px, transparent 56px);
  mask: radial-gradient(circle, transparent 0 54px, #000 54px 56px, transparent 56px);
  opacity: 0.85;
  animation: orbit-spin 3.6s linear infinite;
}

.arc-b {
  inset: 2px;
  background: conic-gradient(from 180deg, transparent 0deg, #62e8d8 48deg, transparent 130deg);
  -webkit-mask: radial-gradient(circle, transparent 0 47px, #000 47px 48.5px, transparent 48.5px);
  mask: radial-gradient(circle, transparent 0 47px, #000 47px 48.5px, transparent 48.5px);
  opacity: 0.7;
  animation: orbit-spin 5.2s linear infinite reverse;
}

@keyframes orbit-spin {
  to { transform: rotate(360deg); }
}

.splash-logo {
  position: relative;
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border-radius: 15px;
  color: var(--accent-contrast);
  background: var(--gradient-brand);
  box-shadow:
    0 0 40px -4px var(--accent),
    0 0 0 1px rgba(255, 255, 255, 0.16) inset,
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

/* === 文字 === */

.splash-title {
  font-size: 19px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-primary);
}

.splash-sub {
  margin-top: 4px;
  font-size: 10px;
  letter-spacing: 0.22em;
  color: var(--text-muted);
}

/* === 分段载入条 === */

.splash-bar {
  display: flex;
  gap: 3px;
  width: 156px;
  margin-top: 22px;
}

.splash-bar i {
  display: block;
  flex: 1;
  height: 2px;
  background: var(--border-color);
  animation: seg-on 0.24s ease forwards;
}

@keyframes seg-on {
  to {
    background: var(--accent);
    box-shadow: 0 0 7px var(--accent);
  }
}

.splash-status {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 14px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  color: var(--text-muted);
  opacity: 0.85;
}

.pulse {
  width: 4px;
  height: 4px;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
  animation: pulse-blink 0.9s steps(2, end) infinite;
}

@keyframes pulse-blink {
  50% { opacity: 0.25; }
}

/* === 四角定位角标 === */

.corner {
  position: absolute;
  width: 26px;
  height: 26px;
  border-color: rgba(255, 255, 255, 0.22);
  border-style: solid;
  border-width: 0;
}

.corner.tl {
  top: 34px;
  left: 40px;
  border-top-width: 1px;
  border-left-width: 1px;
}

.corner.tr {
  top: 34px;
  right: 40px;
  border-top-width: 1px;
  border-right-width: 1px;
}

.corner.bl {
  bottom: 34px;
  left: 40px;
  border-bottom-width: 1px;
  border-left-width: 1px;
}

.corner.br {
  bottom: 34px;
  right: 40px;
  border-bottom-width: 1px;
  border-right-width: 1px;
}
</style>
