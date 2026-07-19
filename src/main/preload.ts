import { contextBridge, ipcRenderer } from 'electron'

const api = {
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll')
  },
  services: {
    invoke: (serviceId: string, method: string, args: unknown[] = []) =>
      ipcRenderer.invoke('services:invoke', serviceId, method, args)
  }
}

contextBridge.exposeInMainWorld('kpAPI', api)

export type KpAPI = typeof api
