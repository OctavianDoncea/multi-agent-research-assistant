export function SkeletonBlock({ lines = 4 }: { lines?: number }) {
    return (
        <div className='animate-pulse space-y-2'>
            {Array.from({ length: lines }).map((_, i) => (
                <div key={i} className='h-3 rounded bg-gray-200 dark:bg-gray-800' style={{ width: `${90 - i * 8}%` }}></div>
            ))}
        </div>
    )
}