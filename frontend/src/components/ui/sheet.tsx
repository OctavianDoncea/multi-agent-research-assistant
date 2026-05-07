import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '../../lib/utils'

export const Sheet = Dialog.Root
export const SheetTrigger = Dialog.Trigger
export const SheetClose = Dialog.Close

const sheetSideClasses: Record<'right' | 'left', string> = {
    right: cn(
        'right-0 top-0 border-l',
        'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right'
    ),
    left: cn(
        'left-0 top-0 border-r',
        'data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left'
    )
}

export function SheetContent({
    className,
    children,
    side = 'right',
    ...props
}: Dialog.DialogContentProps & { side?: 'right' | 'left' }) {
    return (
        <Dialog.Portal>
            <Dialog.Overlay
                className={cn(
                    'fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]',
                    'data-[state=open]:animate-in data-[state=open]:fade-in-0',
                    'data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
                )}
            />
            <Dialog.Content
                className={cn(
                    'fixed z-50 flex h-full w-full flex-col border-border bg-card text-card-foreground shadow-soft outline-none',
                    'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-300',
                    'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-200',
                    sheetSideClasses[side],
                    className
                )}
                {...props}
            >
                {children}
            </Dialog.Content>
        </Dialog.Portal>
    )
}

export const SheetTitle = Dialog.Title
export const SheetDescription = Dialog.Description
