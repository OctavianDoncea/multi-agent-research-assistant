import type { AuthSession, ProgressEvent, ResearchResponse, SessionDetail, SessionListItem, User } from './types'

/**
 * Prefer same-origin `/api` (Vite dev proxy or Vercel rewrites → Render).
 * Cross-origin VITE_API_BASE_URL is ignored on *.vercel.app so login is not
 * blocked by browser CORS when the env still points at onrender.com.
 */
function resolveApiBaseUrl(): string {
    const configured = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
    if (typeof window !== 'undefined' && /\.vercel\.app$/i.test(window.location.hostname)) {
        return ''
    }
    return configured
}

const API_BASE_URL = resolveApiBaseUrl()

const ACCESS_TOKEN_KEY = 'mara_access_token'

export function getAccessToken(): string | null {
    try {
        return sessionStorage.getItem(ACCESS_TOKEN_KEY)
    } catch {
        return null
    }
}

export function setAccessToken(token: string | null): void {
    try {
        if (token) sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
        else sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    } catch {
        // ignore
    }
}

function apiUrl(path: string): string {
    return `${API_BASE_URL}${path}`
}

function authHeaders(extra?: HeadersInit): Headers {
    const headers = new Headers(extra)
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
}

async function parseError(res: Response, fallback: string): Promise<string> {
    try {
        const data = (await res.json()) as { detail?: unknown }
        if (typeof data.detail === 'string') return data.detail
        if (Array.isArray(data.detail)) {
            return data.detail
                .map((d) => (typeof d === 'object' && d && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d)))
                .join('; ')
        }
    } catch {
        // ignore
    }
    return fallback
}

async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(apiUrl(path), {
        credentials: 'include',
        headers: authHeaders()
    })
    if (!res.ok) throw new Error(await parseError(res, `GET ${path} failed: ${res.status}`))
    return (await res.json()) as T
}

async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(apiUrl(path), {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(await parseError(res, `POST ${path} failed: ${res.status}`))
    return (await res.json()) as T
}

export async function getMe(): Promise<User> {
    return apiGet('/api/auth/me')
}

export async function register(email: string, password: string): Promise<AuthSession> {
    const session = await apiPostJson<AuthSession>('/api/auth/register', { email, password })
    setAccessToken(session.access_token)
    return session
}

export async function login(email: string, password: string): Promise<AuthSession> {
    const session = await apiPostJson<AuthSession>('/api/auth/login', { email, password })
    setAccessToken(session.access_token)
    return session
}

export async function logout(): Promise<void> {
    try {
        const res = await fetch(apiUrl('/api/auth/logout'), {
            method: 'POST',
            credentials: 'include',
            headers: authHeaders()
        })
        if (!res.ok) throw new Error(await parseError(res, `POST /api/auth/logout failed: ${res.status}`))
    } finally {
        setAccessToken(null)
    }
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

export async function patchSession(
    id: string,
    body: { title?: string | null; pinned?: boolean | null; tags?: string[] | null; is_public?: boolean | null }
) {
    const res = await fetch(apiUrl(`/api/sessions/${id}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(await parseError(res, `PATCH /api/sessions/${id} failed: ${res.status}`))
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
    const params = new URLSearchParams({ query })
    const token = getAccessToken()
    if (token) params.set('access_token', token)
    const url = apiUrl(`/api/research/stream?${params.toString()}`)
    const es = new EventSource(url, { withCredentials: true })

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

    return () => es.close()
}