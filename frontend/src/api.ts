import type { ProgressEvent, ResearchResponse, SessionDetail, SessionListItem } from './types'

async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(path)
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
    return (await res.json()) as T
}

export async function listSessions(limit = 50): Promise<SessionListItem[]> {
    return apiGet(`/api/sessions?limit=${limit}`)
}

export async function getSession(id: string): Promise<SessionDetail> {
    return apiGet(`/api/session/${id}`)
}

export function researchStream(
    query: string,
    handlers: {
        onSession: (sessionId: string) => void
        onProgress: (evt: ProgressEvent) => void
        onFinal: (data: ResearchResponse) => void
        onServerError: (message: string) => void
        onNetworkError: () => void
    }
): () => void {
    const url = `/api/research/stream?query=${encodeURIComponent(query)}`
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

    es.onerror = () => {
        handlers.onNetworkError()
        es.close()
    }

    return () => es.close
}