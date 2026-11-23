/**
 * 生成 README 用的界面截图。
 *
 * 用法：
 *   npm run screenshots
 *
 * 脚本会用一个临时 userData 目录启动桌面端（不会读取或改动你本机的真实配置），
 * 连接 scripts/screenshots/mock-server.cjs 里的虚构后端，然后把各页面截图写入
 * docs/screenshots/。所有内容来自 fixtures.cjs，可自行替换。
 */

const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { startMockServer } = require('./mock-server.cjs')
const fixtures = require('./fixtures.cjs')

const repoRoot = path.resolve(__dirname, '../..')
const outDir = path.join(repoRoot, 'docs', 'screenshots')
fs.mkdirSync(outDir, { recursive: true })

// 一次性配置目录：不触碰真实用户的设置、密钥与离线缓存。
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-pipeline-shots-'))
app.setPath('userData', scratch)
app.setPath('sessionData', scratch)
app.disableHardwareAcceleration()
delete process.env.VITE_DEV_SERVER_URL

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let win = null
let loadCount = 0
let finished = false

const hardTimeout = setTimeout(() => {
  console.error('截图流程超时')
  shutdown(1)
}, 180000)

function shutdown(code) {
  if (finished) return
  finished = true
  clearTimeout(hardTimeout)
  try { fs.rmSync(scratch, { recursive: true, force: true }) } catch {}
  app.exit(code)
}

async function evaluate(source) {
  return win.webContents.executeJavaScript(source)
}

async function waitFor(expression, label, timeout = 15000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const ok = await evaluate(`(() => { try { return !!(${expression}); } catch { return false; } })()`)
    if (ok) return
    await sleep(200)
  }
  const state = await evaluate(`(() => ({
    hash: location.hash,
    text: document.body.innerText.slice(0, 200).replace(/\\s+/g, ' '),
    articleVisible: !!document.querySelector('.article-title'),
    contentLength: document.querySelector('.article-content')?.textContent?.length ?? 0,
    loading: !!document.querySelector('.reader-loading')
  }))()`)
  throw new Error(`等待超时：${label} | ${JSON.stringify(state)}`)
}

async function seedSettings() {
  return evaluate(`(async () => {
    await window.kpAPI.settings.set('theme', 'dark')
    await window.kpAPI.settings.set('rag', { baseUrl: ${JSON.stringify(fixtures.ORIGIN)} })
    await window.kpAPI.settings.set('services', ${JSON.stringify(fixtures.services)})
    await window.kpAPI.settings.set('relations', ${JSON.stringify(fixtures.relations)})
    await window.kpAPI.settings.set('inquiryThreads', ${JSON.stringify(fixtures.inquiryThreads)})
    const all = await window.kpAPI.settings.getAll()
    return {
      services: all.services.length,
      configured: all.services.filter((service) => service.configured).length,
      rag: all.rag.baseUrl
    }
  })()`)
}

async function capture(name) {
  await sleep(450)
  const image = await win.webContents.capturePage()
  const file = path.join(outDir, `${name}.png`)
  fs.writeFileSync(file, image.toPNG())
  const size = image.getSize()
  console.log(`saved docs/screenshots/${name}.png (${size.width}x${size.height})`)
}

async function goto(hash) {
  await evaluate(`location.hash = ${JSON.stringify(hash)}`)
  await sleep(250)
}

/** 截图前把页面滚回顶部，避免视口停在中间。 */
async function scrollTop() {
  await evaluate(`(() => {
    window.scrollTo(0, 0)
    for (const el of document.querySelectorAll('.reader-view, .knowledge-view, .graph-view, .settings-view, .inquiry-view')) {
      el.scrollTop = 0
    }
    return true
  })()`)
}

async function runShots() {
  try {
    await sleep(700)

    // 1. 首页：RSS / 收藏 / 速记三栏
    await goto('#/')
    await waitFor("document.querySelectorAll('.list-item').length >= 6", '首页三栏数据')
    await scrollTop()
    await capture('home')

    // 2. 阅读视图：正文、大纲、来源信息
    await goto('#/reader/rss/demo-rss-2')
    await waitFor(
      "!!document.querySelector('.article-title') && (document.querySelector('.article-content')?.textContent?.length ?? 0) >= 200",
      '阅读视图正文'
    )
    await scrollTop()
    await capture('reader')

    // 3. 知识图谱：关系节点与边
    await goto('#/graph')
    await waitFor("document.querySelectorAll('.node-circle').length >= 6", '知识图谱节点')
    await capture('graph')

    // 4. 知识问答：先检查本地服务，再提问，等证据卡出现
    await goto('#/knowledge')
    await waitFor("document.body.innerText.includes('本地服务就绪')", '本地知识服务健康检查', 20000)
    await evaluate(`(() => {
      const textarea = document.querySelector('#knowledge-question')
      if (!textarea) return false
      textarea.focus()
      textarea.value = ${JSON.stringify(fixtures.demoQuestion)}
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    await sleep(250)
    const clicked = await evaluate(`(() => {
      const button = document.querySelector('.ask-button')
      if (!button || button.disabled) return false
      button.click()
      return true
    })()`)
    if (!clicked) throw new Error('提问按钮不可用（检查 AI 服务配置是否生效）')
    await waitFor("!!document.querySelector('.answer-card')", '问答结果', 25000)
    // 让提问框、答案与证据卡同时出现在一屏内
    await evaluate(`(() => {
      const view = document.querySelector('.knowledge-view')
      const card = document.querySelector('.answer-card')
      if (!view || !card) return false
      const offset = card.getBoundingClientRect().top - view.getBoundingClientRect().top + view.scrollTop
      view.scrollTop = Math.max(0, offset - 300)
      return true
    })()`)
    await capture('qa')

    // 5. 探究线：问题、证据、当前判断与下一步
    await goto('#/inquiry')
    await waitFor(
      "!!document.querySelector('.inquiry-main') && document.querySelectorAll('.source-card').length >= 3",
      '探究线内容'
    )
    await scrollTop()
    await capture('inquiry')

    // 6. 设置页：四类后端与连接健康检查
    await goto('#/settings')
    await waitFor("document.querySelectorAll('.service-card').length >= 4", '设置页服务列表')
    await evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('测试全部连接'))
      if (!button) return false
      button.click()
      return true
    })()`)
    await waitFor("document.body.innerText.includes('已连接')", '连接健康检查', 20000)
    await scrollTop()
    await capture('settings')

    console.log('done')
    shutdown(0)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    shutdown(1)
  }
}

async function runFirstLoad() {
  try {
    win.show()
    win.setAlwaysOnTop(true)
    await sleep(800)
    const info = await seedSettings()
    console.log('seeded settings:', JSON.stringify(info))
    // 重新加载，让渲染层从主进程读取刚写入的服务配置
    win.webContents.reload()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    shutdown(1)
  }
}

app.on('browser-window-created', (_event, window) => {
  win = window
  window.setSize(1440, 900)
  window.center()

  window.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) console.log(`[renderer:${level}] ${message}`)
  })

  window.webContents.on('did-finish-load', () => {
    loadCount += 1
    if (loadCount === 1) void runFirstLoad()
    else if (loadCount === 2) void runShots()
  })

  window.webContents.on('preload-error', (_event, _file, error) => {
    console.error('preload error:', error.message)
    shutdown(1)
  })
})

app.whenReady().then(async () => {
  const server = await startMockServer()
  console.log(`mock backends on ${fixtures.ORIGIN}`)
  app.on('will-quit', () => server.close())
  require('../../dist-electron/main/index.js')
})
