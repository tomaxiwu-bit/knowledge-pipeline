import type {
  AIClient,
  AIConfig,
  AISummary,
  AISummaryOptions,
  Bookmark,
  BookmarkClient,
  ConnectionResult,
  Memo,
  MemoClient,
  RSSClient,
  RSSItem,
  ServiceConfig
} from '@/services/types'

/**
 * Renderer-side service facade.
 *
 * Credentials and HTTP clients deliberately live in the Electron main process.
 * The renderer only receives an opaque service id and can invoke the small,
 * allow-listed set of adapter operations exposed by preload.
 */
export type RendererServiceClient = RSSClient & BookmarkClient & MemoClient & AIClient

interface ServiceInvocationResponse<T> {
  data: T
  cache: {
    source: 'live' | 'cache'
    storedAt: string
  }
}

export function createRendererServiceClient(
  serviceId: string,
  configured: boolean
): RendererServiceClient {
  const call = async <T>(method: string, ...args: unknown[]): Promise<T> => {
    const response = await window.kpAPI.services.invoke(serviceId, method, args) as ServiceInvocationResponse<T>
    window.dispatchEvent(new CustomEvent('kp:service-response', {
      detail: { serviceId, method, ...response.cache }
    }))
    return response.data
  }

  return {
    // Kept for the shared adapter interface. Configuration happens in main.
    configure: (_config: ServiceConfig | AIConfig) => undefined,
    isConfigured: () => configured,
    testConnection: () => call<ConnectionResult>('testConnection'),

    getUnreadItems: (limit?: number) => call<RSSItem[]>('getUnreadItems', limit),
    getItemContent: (itemId: string) => call<string>('getItemContent', itemId),
    markAsRead: (itemId: string) => call<void>('markAsRead', itemId),
    starItem: (itemId: string) => call<void>('starItem', itemId),

    getBookmarks: (limit?: number) => call<Bookmark[]>('getBookmarks', limit),
    createBookmark: (url: string, title?: string, options?: { entryId?: string; readLaterUntil?: string }) =>
      call<Bookmark | null>('createBookmark', url, title, options),
    archiveBookmark: (id: string) => call<void>('archiveBookmark', id),

    getMemos: (limit?: number) => call<Memo[]>('getMemos', limit),
    createMemo: (content: string) => call<Memo | null>('createMemo', content),
    deleteMemo: (id: string) => call<void>('deleteMemo', id),

    summarize: (text: string, options?: AISummaryOptions) =>
      call<AISummary>('summarize', text, options)
  }
}
