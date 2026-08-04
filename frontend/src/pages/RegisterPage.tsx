import { FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { ThemeToggle, initTheme, type ThemeMode } from '../components/ThemeToggle'

export function RegisterPage() {
    const { user, loading, register } = useAuth()
    const navigate = useNavigate()
    const [theme, setTheme] = useState<ThemeMode>(() => initTheme())
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [submitting, setSubmitting] = useState(false)

    if (!loading && user) {
        return <Navigate to="/" replace />
    }

    async function onSubmit(e: FormEvent) {
        e.preventDefault()
        setSubmitting(true)
        try {
            await register(email.trim(), password)
            toast.success('Account created')
            navigate('/', { replace: true })
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
                        <CardTitle>Create account</CardTitle>
                        <CardDescription>Save research privately and share links when you want.</CardDescription>
                    </CardHeader>
                    <form onSubmit={(e) => void onSubmit(e)}>
                        <CardContent className="space-y-3">
                            <div className="space-y-1.5">
                                <label htmlFor="register-email" className="text-xs font-semibold text-muted-foreground">
                                    Email
                                </label>
                                <Input
                                    id="register-email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="register-password" className="text-xs font-semibold text-muted-foreground">
                                    Password (min 8 characters)
                                </label>
                                <Input
                                    id="register-password"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    minLength={8}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col items-stretch gap-3">
                            <Button type="submit" disabled={submitting || loading} className="font-bold">
                                {submitting ? 'Creating…' : 'Create account'}
                            </Button>
                            <p className="text-center text-sm text-muted-foreground">
                                Already have an account?{' '}
                                <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
                                    Sign in
                                </Link>
                            </p>
                        </CardFooter>
                    </form>
                </Card>
            </main>
        </div>
    )
}