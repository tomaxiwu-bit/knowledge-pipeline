import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron'
import Store from 'electron-store'
import { createHash } from 'crypto'
import path from 'path'
import { pathToFileURL } from 'url'
import { createClient } from '../services/registry'
import '../services'
import type { AIConfig, ServiceInstance, ServiceKind } from '../services/types'
import { answerKnowledgeWithAI, DEFAULT_RAG_SETTINGS, invokeRagBackend, validateRagSettings, type RagBackendOperation, type RagSettings } from './rag'

const isDev = !app.isPackaged
const SECRET_FIELDS = ['apiKey', 'token', 'password'] as const

type StoredServiceInstance = Omit<ServiceInstance, 'config'> & {
  config: Record<string, unknown>
}

interface CacheEntry {
  data: unknown
  storedAt: string
}

const settingsStore = new Store({
  name: 'knowledge-pipeline-settings',
  defaults: {
    theme: 'dark',
    services: [] as StoredServiceInstance[],
    rag: DEFAULT_RAG_SETTINGS
  }
})

const secretsStore = new Store({
  name: 'knowledge-pipeline-secrets',
  defaults: {
    values: {} as Record<string, string>
  }
})

const cacheStore = new Store({
  name: 'knowledge-pipeline-cache',
  defaults: {
    entries: {} as Record<string, CacheEntry>
  }
})

const looseSettingsStore = settingsStore as unknown as {
  get(key: string): unknown
  set(key: string, value: unknown): void
  delete(key: string): void
}

const SERVICE_METHODS: Record<ServiceKind, ReadonlySet<string>> = {
  rss: new Set(['testConnection', 'getUnreadItems', 'getItemContent', 'markAsRead', 'starItem']),
  bookmark: new Set(['testConnection', 'getBookmarks', 'createBookmark', 'archiveBookmark']),
  memo: new Set(['testConnection', 'getMemos', 'createMemo', 'deleteMemo']),
  ai: new Set(['testConnection', 'summarize', 'answer'])
}

const CACHEABLE_SERVICE_METHODS = new Set([
  'getUnreadItems',
  'getItemContent',
  'getBookmarks',
  'getMemos'
])
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const CACHE_ENTRY_LIMIT = 250

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function getStoredServices(): StoredServiceInstance[] {
  const services = settingsStore.get('services')
  return Array.isArray(services) ? services as StoredServiceInstance[] : []
}

function secretKey(serviceId: string, field: string): string {
  return `${serviceId}:${field}`
}

function usesSecureStorage(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false
  // Linux can fall back to basic_text when no keyring is available. Treat that
  // as unavailable rather than incorrectly claiming that credentials are safe.
  return process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'
}

function encryptSecret(value: string): string {
  if (!usesSecureStorage()) {
    throw new Error('系统安全凭据存储不可用，无法保存 API Key。请配置系统钥匙串后重试。')
  }
  return safeStorage.encryptString(value).toString('base64')
}

function decryptSecret(value: string): string {
  return safeStorage.decryptString(Buffer.from(value, 'base64'))
}

function getStoredSecrets(): Record<string, string> {
  return asRecord(secretsStore.get('values')) as Record<string, string>
}

function cacheKey(serviceId: string, method: string, args: unknown[]): string {
  return createHash('sha256')
    .update(JSON.stringify([serviceId, method, args]))
    .digest('hex')
}

function getCacheEntries(): Record<string, CacheEntry> {
  return asRecord(cacheStore.get('entries')) as Record<string, CacheEntry>
}

function getFreshCacheEntry(key: string): CacheEntry | null {
  const entry = getCacheEntries()[key]
  if (!entry || typeof entry.storedAt !== 'string') return null
  const timestamp = Date.parse(entry.storedAt)
  if (!Number.isFinite(timestamp) || Date.now() - timestamp > CACHE_MAX_AGE_MS) return null
  return entry
}

function setCacheEntry(key: string, data: unknown): CacheEntry {
  const entry: CacheEntry = { data, storedAt: new Date().toISOString() }
  const entries = { ...getCacheEntries(), [key]: entry }
  const keysByAge = Object.entries(entries)
    .sort(([, a], [, b]) => {
      const aTime = Date.parse(a.storedAt)
      const bTime = Date.parse(b.storedAt)
      return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0)
    })
    .map(([entryKey]) => entryKey)

  while (keysByAge.length > CACHE_ENTRY_LIMIT) {
    const oldestKey = keysByAge.shift()
    if (oldestKey) delete entries[oldestKey]
  }

  cacheStore.set('entries', entries)
  return entry
}

function isServiceConfigured(service: StoredServiceInstance, secrets = getStoredSecrets()): boolean {
  const baseUrl = service.config.baseUrl
  if (typeof baseUrl !== 'string' || !baseUrl.trim()) return false
  if (service.kind === 'ai') {
    return typeof service.config.model === 'string' && !!service.config.model.trim()
  }
  return SECRET_FIELDS.some((field) => !!secrets[secretKey(service.id, field)])
}

function toPublicService(service: StoredServiceInstance): ServiceInstance {
  const config = { ...service.config }
  for (const field of SECRET_FIELDS) config[field] = ''
  return {
    ...service,
    config: config as unknown as ServiceInstance['config'],
    configured: isServiceConfigured(service)
  }
}

function publicSettings() {
  return {
    theme: settingsStore.get('theme'),
    services: getStoredServices().map(toPublicService),
    rag: getRagSettings()
  }
}

function getRagSettings(): RagSettings {
  try {
    return validateRagSettings(looseSettingsStore.get('rag'))
  } catch {
    return DEFAULT_RAG_SETTINGS
  }
}

function validateService(value: unknown): StoredServiceInstance {
  const input = asRecord(value)
  const id = input.id
  const name = input.name
  const kind = input.kind
  const clientId = input.clientId
  const config = asRecord(input.config)

  if (
    typeof id !== 'string' || !/^[a-zA-Z0-9_-]{3,96}$/.test(id) ||
    typeof name !== 'string' || !name.trim() || name.length > 120 ||
    (kind !== 'rss' && kind !== 'bookmark' && kind !== 'memo' && kind !== 'ai') ||
    typeof clientId !== 'string' || !/^[a-zA-Z0-9_-]{2,96}$/.test(clientId) ||
    typeof config.baseUrl !== 'string' || config.baseUrl.length > 2048
  ) {
    throw new Error('服务配置格式无效')
  }

  if (kind === 'ai' && (typeof config.model !== 'string' || !config.model.trim() || config.model.length > 256)) {
    throw new Error('AI 服务必须包含模型名称')
  }

  return { id, name: name.trim(), kind, clientId, config }
}

/**
 * Persist public service metadata separately from encrypted credential values.
 * Blank secret fields keep an existing secret during a non-secret update.
 */
function saveServices(value: unknown): ServiceInstance[] {
  if (!Array.isArray(value) || value.length > 50) {
    throw new Error('服务配置数量无效')
  }

  const current = new Map(getStoredServices().map((service) => [service.id, service]))
  const nextSecrets = { ...getStoredSecrets() }
  const next: StoredServiceInstance[] = []
  const ids = new Set<string>()

  for (const item of value) {
    const service = validateService(item)
    if (ids.has(service.id)) throw new Error('服务配置 ID 重复')
    ids.add(service.id)

    const publicConfig = { ...service.config }
    const previous = current.get(service.id)
    for (const field of SECRET_FIELDS) {
      const submitted = publicConfig[field]
      if (typeof submitted === 'string' && submitted.trim()) {
        nextSecrets[secretKey(service.id, field)] = encryptSecret(submitted.trim())
      } else if (!previous) {
        delete nextSecrets[secretKey(service.id, field)]
      }
      delete publicConfig[field]
    }

    next.push({ ...service, config: publicConfig })
  }

  // Delete credentials belonging to removed service instances.
  for (const key of Object.keys(nextSecrets)) {
    const [id] = key.split(':', 1)
    if (!ids.has(id)) delete nextSecrets[key]
  }

  settingsStore.set('services', next)
  secretsStore.set('values', nextSecrets)
  return next.map(toPublicService)
}

function hydrateServiceConfig(service: StoredServiceInstance): ServiceInstance['config'] {
  const config: Record<string, unknown> = { ...service.config }
  const secrets = getStoredSecrets()
  for (const field of SECRET_FIELDS) {
    const encrypted = secrets[secretKey(service.id, field)]
    if (encrypted) config[field] = decryptSecret(encrypted)
  }
  return config as unknown as ServiceInstance['config']
}

function migrateStoredSecrets(): void {
  // If the OS keychain is unavailable, skip migration entirely instead of
  // crashing. Credentials will remain in their current (possibly legacy)
  // location until the user configures a working keychain.
  if (!usesSecureStorage()) return

  const services = getStoredServices()
  if (services.length > 0) {
    // Older versions stored apiKey directly inside the settings file. Re-save
    // them once to move the value into the OS-protected secret store.
    if (services.some((service) => SECRET_FIELDS.some((field) => typeof service.config[field] === 'string' && service.config[field]))) {
      saveServices(services)
    }
    return
  }

  const legacy = [
    { key: 'freshrss', id: 'migrated-freshrss', name: 'FreshRSS', kind: 'rss', clientId: 'freshrss', secret: 'apiKey' },
    { key: 'karakeep', id: 'migrated-karakeep', name: 'Karakeep', kind: 'bookmark', clientId: 'karakeep', secret: 'apiKey' },
    { key: 'memos', id: 'migrated-memos', name: 'Memos', kind: 'memo', clientId: 'memos', secret: 'token' }
  ] as const

  const migrated: Record<string, unknown>[] = []
  for (const entry of legacy) {
    const config = asRecord(looseSettingsStore.get(entry.key))
    if (typeof config.baseUrl === 'string' && config.baseUrl.trim()) {
      migrated.push({
        id: entry.id,
        name: entry.name,
        kind: entry.kind,
        clientId: entry.clientId,
        config: { baseUrl: config.baseUrl, apiKey: config[entry.secret] ?? '' }
      })
    }
  }

  if (migrated.length > 0) saveServices(migrated)
  for (const entry of legacy) looseSettingsStore.delete(entry.key)
}

function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isTrustedAppUrl(value: string): boolean {
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    try {
      return new URL(value).origin === new URL(process.env.VITE_DEV_SERVER_URL).origin
    } catch {
      return false
    }
  }
  const appUrl = pathToFileURL(path.join(__dirname, '../../dist/index.html')).href
  return value === appUrl || value.startsWith(`${appUrl}#`)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: '知识流水线',
    backgroundColor: '#1a1a2e',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: true
    }
  })

  const showTimeout = setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) win.show()
  }, 5000)

  win.once('ready-to-show', () => {
    clearTimeout(showTimeout)
    win.show()
  })

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (isTrustedAppUrl(url)) return
    event.preventDefault()
    if (isSafeExternalUrl(url)) void shell.openExternal(url)
  })

  win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  win.webContents.session.setPermissionCheckHandler(() => false)
}

ipcMain.handle('settings:get', (_event, key: unknown) => {
  if (key === 'services') return getStoredServices().map(toPublicService)
  if (key === 'theme') return settingsStore.get('theme')
  if (key === 'rag') return getRagSettings()
  if (key === 'relations' || key === 'savedSearches' || key === 'customTemplates' || key === 'inquiryThreads') return looseSettingsStore.get(key)
  throw new Error('不允许读取该设置项')
})

ipcMain.handle('settings:set', (_event, key: unknown, value: unknown) => {
  if (key === 'services') return saveServices(value)
  if (key === 'theme') {
    if (value !== 'light' && value !== 'dark') throw new Error('主题值无效')
    settingsStore.set('theme', value)
    return true
  }
  if (key === 'rag') {
    const rag = validateRagSettings(value)
    settingsStore.set('rag', rag)
    return rag
  }
  if (key === 'relations' || key === 'savedSearches' || key === 'customTemplates' || key === 'inquiryThreads') {
    if (!Array.isArray(value)) throw new Error('设置值格式无效')
    looseSettingsStore.set(key, value)
    return true
  }
  throw new Error('不允许写入该设置项')
})

ipcMain.handle('settings:getAll', () => publicSettings())

ipcMain.handle('services:invoke', async (_event, serviceId: unknown, method: unknown, args: unknown) => {
  if (typeof serviceId !== 'string' || typeof method !== 'string' || !Array.isArray(args)) {
    throw new Error('服务调用参数无效')
  }

  const service = getStoredServices().find((item) => item.id === serviceId)
  if (!service) throw new Error('服务配置不存在')
  if (!SERVICE_METHODS[service.kind].has(method)) throw new Error('不允许的服务操作')

  const client = createClient(service.clientId)
  if (!client) throw new Error('未知服务适配器')
  client.configure(hydrateServiceConfig(service) as AIConfig)

  const operation = (client as unknown as Record<string, unknown>)[method]
  if (typeof operation !== 'function') throw new Error('服务不支持该操作')

  const cacheable = CACHEABLE_SERVICE_METHODS.has(method)
  const key = cacheable ? cacheKey(serviceId, method, args) : ''
  try {
    const data = await (operation as (...params: unknown[]) => unknown).apply(client, args)
    const entry = cacheable ? setCacheEntry(key, data) : null
    return {
      data,
      cache: { source: 'live' as const, storedAt: entry?.storedAt ?? new Date().toISOString() }
    }
  } catch (error) {
    const cached = cacheable ? getFreshCacheEntry(key) : null
    if (cached) {
      return {
        data: cached.data,
        cache: { source: 'cache' as const, storedAt: cached.storedAt }
      }
    }
    throw error
  }
})

ipcMain.handle('rag:invoke', async (_event, operation: unknown, payload: unknown) => {
  if (operation !== 'health' && operation !== 'index' && operation !== 'search' && operation !== 'ask' && operation !== 'delete') {
    throw new Error('不允许的 RAG 操作')
  }
  if (operation === 'ask') {
    const ai = getStoredServices().find((service) => service.kind === 'ai' && isServiceConfigured(service))
    if (ai) {
      const client = createClient(ai.clientId)
      if (!client || !('answer' in client)) throw new Error('AI 服务不支持知识问答')
      client.configure(hydrateServiceConfig(ai) as AIConfig)
      return answerKnowledgeWithAI(getRagSettings(), payload, client)
    }
  }
  return invokeRagBackend(getRagSettings(), operation as RagBackendOperation, payload)
})

app.whenReady().then(() => {
  try {
    migrateStoredSecrets()
  } catch (error) {
    console.error('[Migration] 凭据迁移失败，跳过:', error)
  }
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
