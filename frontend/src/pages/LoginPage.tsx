import { FormEvent, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { ThemeToggle, initTheme, type ThemeMode } from '../components/ThemeToggle'

export function LoginPage() {
    const { user, loading, login } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [theme, setTheme] = useState<ThemeMode>(() => initTheme())
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const from = (location.state as { from?: string } | null)?.from || '/'

    if (!loading && user) {
        return <Navigate to={from} replace />
    }

    async function onSubmit(e: FormEvent) {
        e.preventDefault()
        setSubmitting(true)
        try {
            await login(email.trim(), password)
            toast.success('Signed in')
            navigate(from, { replace: true })
        } catch (err) {
            toast.error(String(err))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Multi-agent</div>
                    <div className="text-sm font-bold tracking-tight">Research Assistant</div>
                </div>
                <ThemeToggle mode={theme} onChange={setTheme} />
            </header>
            <main className="flex flex-1 items-center justify-center p-4">
                <Card className="w-full max-w-md shadow-soft">
                    <CardHeader>
                        <CardTitle>Sign in</CardTitle>
                        <CardDescription>Access your private research sessions.</CardDescription>
                    </CardHeader>
                    <form onSubmit={(e) => void onSubmit(e)}>
                        <CardContent className="space-y-3">
                            <div className="space-y-1.5">
                                <label htmlFor="login-email" className="text-xs font-semibold text-muted-foreground">
                                    Email
                                </label>
                                <Input
                                    id="login-email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="login-password" className="text-xs font-semibold text-muted-foreground">
                                    Password
                                </label>
                                <Input
                                    id="login-password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    minLength={8}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col items-stretch gap-3">
                            <Button type="submit" disabled={submitting || loading} className="font-bold">
                                {submitting ? 'Signing in…' : 'Sign in'}
                            </Button>
                            <p className="text-center text-sm text-muted-foreground">
                                No account?{' '}
                                <Link to="/register" className="font-semibold text-primary underline-offset-4 hover:underline">
                                    Create one
                                </Link>
                            </p>
                        </CardFooter>
                    </form>
                </Card>
            </main>
        </div>
    )
}