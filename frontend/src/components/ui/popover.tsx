import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '../../lib/utils'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger

export function PopoverContent({ className, align='center', sideOffset=6, ...props } : PopoverPrimitive.PopoverContentProps) {
    return (
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
                align={align}
                sideOffset={sideOffset}
                className={cn(
                    'z-50 w-80 rouned-lg border borer-border bg-card p-3 text-card-foreground shoadow-soft outline-none',
                    'data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95',
                    'data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95',
                    className
                )}
                {...props}
            />
        </PopoverPrimitive.Portal>
    )
}