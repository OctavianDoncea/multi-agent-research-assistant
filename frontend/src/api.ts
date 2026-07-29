import type { ProgressEvent, ResearchResponse, SessionDetail, SessionListItem } from './types'

/** Empty in local Vite (proxy); set on Vercel to the Render backend origin. */
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

function apiUrl(path: string): string {
    return `${API_BASE_URL}${path}`
}

async function apiGet<T>(path: string): Promise<T> {
    const url = apiUrl(path)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
    return (await res.json()) as T
}

export async function listSessions(limit = 50, q?: string, tag?: string): Promise<SessionListItem[]> {
    const params = new URLSearchParams({ limit: String(limit) })
    if (q) params.set('q', q)
    if (tag) params.set('tag', tag)
    return apiGet(`/api/sessions?${params.toString()}`)
}

export async function getSession(id: string): Promise<SessionDetail> {
    return apiGet(`/api/sessions/${id}`)
}

export async function patchSession(id: string, body: { title?: string | null; pinned?: boolean | null; tags?: string[] | null }) {
    const res = await fetch(apiUrl(`/api/sessions/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(`PATCH /api/sessions/${id} failed: ${res.status}`)
    return (await res.json()) as SessionDetail
}

export function researchStream(
    query: string,
    handlers: {
        onSession: (sessionId: string) => void
        onProgress: (evt: ProgressEvent) => void
        onFinal: (data: ResearchResponse) => void
        onServerError: (message: string) => void
        onNetworkError: () => void
        onSummaryDelta?: (delta: string) => void
    }
): () => void {
    const url = apiUrl(`/api/research/stream?query=${encodeURIComponent(query)}`)
    const es = new EventSource(url)

    es.addEventListener('session', (e) => {
        try {
            const data = JSON.parse((e as MessageEvent).data) as { session_id: string }
            handlers.onSession(data.session_id)
        } catch {
            // ignore
        }
    })

    es.addEventListener('progress', (e) => {
        try {
            const data = JSON.parse((e as MessageEvent).data) as ProgressEvent
            handlers.onProgress(data)
        } catch {
            // ignore
        }
    })

    es.addEventListener('final', (e) => {
        try {
            const data = JSON.parse((e as MessageEvent).data) as ResearchResponse
            handlers.onFinal(data)
        } catch (err) {
            handlers.onServerError(`Failed to parse final payload: ${String(err)}`)
        } finally {
            es.close()
        }
    })

    es.addEventListener('server_error', (e) => {
        try {
            const data = JSON.parse((e as MessageEvent).data) as { message: string }
            handlers.onServerError(data.message)
        } catch {
            handlers.onServerError('Server error')
        } finally {
            es.close()
        }
    })

    es.addEventListener('summary_delta', (e) => {
        try {
            const data = JSON.parse((e as MessageEvent).data) as { delta: string }
            handlers.onSummaryDelta?.(data.delta)
        } catch {}
    })

    es.onerror = () => {
        handlers.onNetworkError()
        es.close()
    }

    return () => es.close
}