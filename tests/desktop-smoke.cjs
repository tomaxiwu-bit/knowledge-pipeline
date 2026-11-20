const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

// Use disposable settings, and keep the test window hidden throughout startup.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-pipeline-smoke-'))
app.setPath('userData', scratch)
app.setPath('sessionData', scratch)
app.disableHardwareAcceleration()
BrowserWindow.prototype.show = function () {}
delete process.env.VITE_DEV_SERVER_URL
const timeout = setTimeout(() => {
  console.error('Desktop startup timed out')
  app.exit(1)
}, 30000)
app.on('browser-window-created', (_event, window) => {
  window.webContents.once('preload-error', (_event, _file, error) => {
    console.error(error.message)
    app.exit(1)
  })
  window.webContents.once('did-finish-load', async () => {
    try {
      const result = await window.webContents.executeJavaScript(`(async () => {
        if (!window.kpAPI?.settings?.getAll || !window.kpAPI?.services?.invoke || !window.kpAPI?.rag?.invoke) {
          throw new Error('Desktop preload bridge is missing')
        }
        const settings = await window.kpAPI.settings.getAll()
        if (!Array.isArray(settings.services)) throw new Error('Settings IPC did not return services')
        if (settings.services.length !== 0) throw new Error('Smoke test did not use an empty profile')
        const saved = await window.kpAPI.settings.set('services', [{
          id: 'smoke-ai', name: 'Smoke API', kind: 'ai', clientId: 'anthropic',
          config: { baseUrl: 'https://api.anthropic.com', apiKey: 'dummy-smoke-key', model: 'smoke-model' }
        }])
        if (!saved[0]?.configured || JSON.stringify(saved).includes('dummy-smoke-key')) {
          throw new Error('API credentials were not saved behind the main-process boundary')
        }
        return { preload_bridge: true, settings_ipc: true, empty_test_profile: true, credentials_protected: true }
      })()`)
      clearTimeout(timeout)
      console.log(JSON.stringify(result))
      app.exit(0)
    } catch (error) {
      console.error(error.message)
      app.exit(1)
    }
  })
})
require('../dist-electron/main/index.js')
