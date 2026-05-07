import * as React from 'react'
import { cn } from '../../lib/utils'

export function Progress({ value, className }: { value: number, className?: string }) {
    return (
        <div className={cn('relative h-2.5 w-full overflow-hidden rounded-full bg-muted', className)}>
            <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-fuchsia-500 transition-[transform] duration-500 ease-out"
                style={{ transform: `translateX(-${100 - Math.max(0, Math.min(100, value))}%)` }}
            />
        </div>
    )
}