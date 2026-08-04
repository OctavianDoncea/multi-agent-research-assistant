import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getMe, login as apiLogin, logout as apiLogout, register as apiRegister } from '../api'
import type { User } from '../types'

type AuthContextValue = {
    user: User | null
    loading: boolean
    login: (email: string, password: string) => Promise<void>
    register: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
    refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    const refresh = useCallback(async () => {
        try {
            const me = await getMe()
            setUser(me)
        } catch {
            setUser(null)
        }
    }, [])

    useEffect(() => {
        let alive = true
        ;(async () => {
            try {
                const me = await getMe()
                if (alive) setUser(me)
            } catch {
                if (alive) setUser(null)
            } finally {
                if (alive) setLoading(false)
            }
        })()
        return () => {
            alive = false
        }
    }, [])

    const establishSession = useCallback(async (authenticate: () => Promise<User>) => {
        await authenticate()
        // Confirm the httpOnly cookie is actually stored/sent (fails on misconfigured
        // cross-origin cookies, e.g. SameSite=Lax between Vercel and Render).
        try {
            const me = await getMe()
            setUser(me)
        } catch {
            setUser(null)
            throw new Error(
                'Signed in, but the session cookie was blocked. On a split-origin deploy, set COOKIE_SAMESITE=none, COOKIE_SECURE=true, and COOKIE_PARTITIONED=true on the API, and include this site in CORS_ORIGINS.'
            )
        }
    }, [])

    const login = useCallback(
        async (email: string, password: string) => {
            await establishSession(() => apiLogin(email, password))
        },
        [establishSession]
    )

    const register = useCallback(
        async (email: string, password: string) => {
            await establishSession(() => apiRegister(email, password))
        },
        [establishSession]
    )

    const logout = useCallback(async () => {
        await apiLogout()
        setUser(null)
    }, [])

    const value = useMemo(
        () => ({ user, loading, login, register, logout, refresh }),
        [user, loading, login, register, logout, refresh]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}