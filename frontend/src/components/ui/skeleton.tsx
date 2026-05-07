import { cn } from '../../lib/utils'

export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                'rounded-full bg-muted/70 animate-pulse motion-reduce:animate-none',
                className
            )}
            style={{ animationDuration: '1.15s' }}
        />
    )
}
