import { Skeleton } from './ui/skeleton'
import { cn } from '../lib/utils'

export function SkeletonBlock({ lines = 4 }: { lines?: number }) {
  const widths = ['w-full', 'w-[88%]', 'w-[72%]', 'w-[92%]', 'w-[68%]', 'w-[84%]', 'w-[76%]']
  return (
    <div className="space-y-3 animate-in fade-in-0 duration-500">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-2.5', widths[i % widths.length])} />
      ))}
    </div>
  )
}