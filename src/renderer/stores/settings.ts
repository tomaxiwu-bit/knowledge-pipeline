import { defineStore } from 'pinia'
import { reactive, ref, computed } from 'vue'
import { createRendererServiceClient, type RendererServiceClient } from '@/renderer/services/clientProxy'
import type {
  ServiceInstance,
  ServiceKind,
  ServiceStatus,
  ConnectionResult,
  AllSettings,
  LegacyAllSettings
} from '@/services/types'
import type { RSSClient, BookmarkClient, MemoClient, AIClient } from '@/services/types'

export type Theme = 'light' | 'dark'

// 运行时缓存的客户端实例（key = ServiceInstance.id）
interface ClientEntry {
  instance: RendererServiceClient
  status: ServiceStatus
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<Theme>('dark')
  const services = ref<ServiceInstance[]>([])
  const clientMap = reactive<Map<string, ClientEntry>>(new Map())

  let loaded = false

  function applyTheme(t: Theme) {
    theme.value = t
    document.documentElement.setAttribute('data-theme', t)
  }

  /** 旧版配置迁移到新版 services 数组 */
  function migrateLegacy(legacy: LegacyAllSettings): ServiceInstance[] {
    const out: ServiceInstance[] = []
    if (legacy.freshrss?.baseUrl) {
      out.push({
        id: 'migrated-freshrss',
        name: 'FreshRSS',
        kind: 'rss',
        clientId: 'freshrss',
        config: legacy.freshrss
      })
    }
    if (legacy.karakeep?.baseUrl) {
      out.push({
        id: 'migrated-karakeep',
        name: 'Karakeep',
        kind: 'bookmark',
        clientId: 'karakeep',
        config: legacy.karakeep
      })
    }
    if (legacy.memos?.baseUrl) {
      out.push({
        id: 'migrated-memos',
        name: 'Memos',
        kind: 'memo',
        clientId: 'memos',
        config: { baseUrl: legacy.memos.baseUrl, apiKey: legacy.memos.token }
      })
    }
    return out
  }

  async function load(force = false) {
    if (loaded && !force) return
    try {
      const all = await window.kpAPI.settings.getAll() as Partial<AllSettings> & Partial<LegacyAllSettings>

      // 迁移旧版配置
      if (all.services && Array.isArray(all.services)) {
        services.value = all.services
      } else {
        // 旧版结构，执行迁移
        const migrated = migrateLegacy(all as LegacyAllSettings)
        services.value = migrated
        if (migrated.length > 0) {
          await window.kpAPI.settings.set('services', migrated)
          // 清理旧字段
          await window.kpAPI.settings.set('freshrss', null)
          await window.kpAPI.settings.set('karakeep', null)
          await window.kpAPI.settings.set('memos', null)
        }
      }

      if (all.theme) applyTheme(all.theme)
      else applyTheme('dark')

      applyConfigsToClients()
      loaded = true
    } catch (e) {
      console.error('加载设置失败', e)
      applyTheme('dark')
    }
  }

  async function save() {
    const saved = await window.kpAPI.settings.set('services', services.value)
    // The main process returns a redacted representation. This clears API keys
    // from renderer memory as soon as a service has been saved.
    if (Array.isArray(saved)) services.value = saved as ServiceInstance[]
    await window.kpAPI.settings.set('theme', theme.value)
    applyConfigsToClients()
  }

  async function toggleTheme() {
    const next: Theme = theme.value === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    await window.kpAPI.settings.set('theme', next)
  }

  /** 把所有已配置服务的配置应用到对应客户端实例 */
  function applyConfigsToClients() {
    clientMap.clear()
    for (const svc of services.value) {
      clientMap.set(svc.id, {
        instance: createRendererServiceClient(svc.id, !!svc.configured),
        status: svc.configured ? 'idle' : 'unconfigured'
      })
    }
  }

  /** 在主进程执行连接测试；密钥不离开受保护的主进程。 */
  async function testService(id: string) {
    const entry = clientMap.get(id)
    if (!entry) return { success: false, message: '服务配置不存在' }
    try {
      const result = await entry.instance.testConnection()
      entry.status = result.success ? 'connected' : 'error'
      return result
    } catch (error) {
      entry.status = 'error'
      return { success: false, message: error instanceof Error ? error.message : '连接失败' }
    }
  }

  /** Test every configured instance without exposing credentials to the renderer. */
  async function testAllServices(): Promise<Record<string, ConnectionResult>> {
    const results: Record<string, ConnectionResult> = {}
    for (const service of services.value) {
      if (!service.configured) continue
      results[service.id] = await testService(service.id)
    }
    return results
  }

  /** 添加一个新后端实例 */
  async function addService(svc: Omit<ServiceInstance, 'id'>): Promise<string> {
    const id = `svc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const instance: ServiceInstance = { ...svc, id }
    services.value.push(instance)
    await save()
    return id
  }

  /** 更新一个后端实例 */
  async function updateService(id: string, patch: Partial<ServiceInstance>): Promise<void> {
    const idx = services.value.findIndex((s) => s.id === id)
    if (idx < 0) return
    services.value[idx] = { ...services.value[idx], ...patch }
    await save()
  }

  /** 删除一个后端实例 */
  async function removeService(id: string): Promise<void> {
    services.value = services.value.filter((s) => s.id !== id)
    clientMap.delete(id)
    await save()
  }

  /** 获取某个环节的第一个可用客户端 */
  function getClientByKind(kind: ServiceKind): RSSClient | BookmarkClient | MemoClient | AIClient | null {
    for (const svc of services.value) {
      if (svc.kind === kind) {
        const entry = clientMap.get(svc.id)
        if (entry) return entry.instance
      }
    }
    return null
  }

  /** 获取某个环节第一个实例的状态 */
  function getStatusByKind(kind: ServiceKind): ServiceStatus {
    for (const svc of services.value) {
      if (svc.kind === kind) {
        const entry = clientMap.get(svc.id)
        if (entry) return entry.status
      }
    }
    return 'unconfigured'
  }

  /** 设置某个实例的状态 */
  function setInstanceStatus(id: string, status: ServiceStatus) {
    const entry = clientMap.get(id)
    if (entry) entry.status = status
  }

  /** 按环节分组的服务列表（给 UI 用） */
  const servicesByKind = computed(() => {
    const groups: Record<ServiceKind, ServiceInstance[]> = {
      rss: [],
      bookmark: [],
      memo: [],
      ai: []
    }
    for (const svc of services.value) {
      groups[svc.kind].push(svc)
    }
    return groups
  })

  return {
    theme,
    services,
    servicesByKind,
    clientMap,
    load,
    save,
    toggleTheme,
    addService,
    updateService,
    removeService,
    getClientByKind,
    getStatusByKind,
    setInstanceStatus,
    testService,
    testAllServices
  }
})
