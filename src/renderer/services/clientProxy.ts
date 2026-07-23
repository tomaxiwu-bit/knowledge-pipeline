import type {
  AIClient, AISummary, AISummaryOptions,
  Bookmark, BookmarkClient,
  ConnectionResult,
  Memo, MemoClient,
  RSSClient, RSSItem,
  ServiceConfig, AIConfig,
  ServiceKind
} from '@/services/types'

/**
 * Renderer-side service facade.
 *
 * Credentials and HTTP clients deliberately live in the Electron main process.
 * The renderer only receives an opaque service id and can invoke the small,
 * allow-listed set of adapter operations exposed by preload.
 */

interface ServiceInvocationResponse<T> {
  data: T
  cache: {
    source: 'live' | 'cache'
    storedAt: string
  }
}

/**
 * Renderer-side service client — a discriminated union keyed by `kind`.
 *
 * Each variant carries only the methods relevant to its service kind. Callers
 * that need kind-specific methods must narrow via the `kind` discriminant
 * (e.g. `if (client.kind === 'rss') { ... }`) or cast through the base
 * interface returned by `getClientByKind`.
 */
export type RendererServiceClient =
  | (RSSClient & { kind: 'rss' })
  | (BookmarkClient & { kind: 'bookmark' })
  | (MemoClient & { kind: 'memo' })
  | (AIClient & { kind: 'ai' })

export function createRendererServiceClient(
  serviceId: string,
  kind: ServiceKind,
  configured: boolean
): RendererServiceClient {
  const call = async <T>(method: string, ...args: unknown[]): Promise<T> => {
    const response = await window.kpAPI.services.invoke(serviceId, method, args) as ServiceInvocationResponse<T>
    window.dispatchEvent(new CustomEvent('kp:service-response', {
      detail: { serviceId, method, ...response.cache }
    }))
    return response.data
  }

  const base = {
    configure: (_config: ServiceConfig | AIConfig) => undefined,
    isConfigured: () => configured,
    testConnection: () => call<ConnectionResult>('testConnection'),
  }

  switch (kind) {
    case 'rss':
      return {
        ...base,
        kind: 'rss' as const,
        getUnreadItems: (limit?: number) => call<RSSItem[]>('getUnreadItems', limit),
        getItemContent: (itemId: string) => call<string>('getItemContent', itemId),
        markAsRead: (itemId: string) => call<void>('markAsRead', itemId),
        starItem: (itemId: string) => call<void>('starItem', itemId),
      }
    case 'bookmark':
      return {
        ...base,
        kind: 'bookmark' as const,
        getBookmarks: (limit?: number) => call<Bookmark[]>('getBookmarks', limit),
        createBookmark: (url: string, title?: string, options?: { entryId?: string; readLaterUntil?: string }) =>
          call<Bookmark | null>('createBookmark', url, title, options),
        archiveBookmark: (id: string) => call<void>('archiveBookmark', id),
      }
    case 'memo':
      return {
        ...base,
        kind: 'memo' as const,
        getMemos: (limit?: number) => call<Memo[]>('getMemos', limit),
        createMemo: (content: string) => call<Memo | null>('createMemo', content),
        deleteMemo: (id: string) => call<void>('deleteMemo', id),
      }
    case 'ai':
      return {
        ...base,
        kind: 'ai' as const,
        summarize: (text: string, options?: AISummaryOptions) =>
          call<AISummary>('summarize', text, options),
      }
    default: {
      // Exhaustiveness guard — if ServiceKind gains a new variant this will
      // surface a compile-time error in the switch above.
      const _exhaustive: never = kind
      throw new Error(`不支持的服务类型: ${_exhaustive}`)
    }
  }
}
