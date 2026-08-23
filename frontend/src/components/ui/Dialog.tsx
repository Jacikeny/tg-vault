import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const focusSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
    open,
    onClose,
    children,
    labelledBy,
    describedBy,
    alert = false,
    closeOnEscape = true,
    closeOnBackdrop = true,
    className = '',
}: {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    labelledBy: string;
    describedBy?: string;
    alert?: boolean;
    closeOnEscape?: boolean;
    closeOnBackdrop?: boolean;
    className?: string;
}) {
    const contentRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const content = contentRef.current;
        const focusables = () => Array.from(content?.querySelectorAll<HTMLElement>(focusSelector) || []);
        focusables()[0]?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && closeOnEscape) { event.preventDefault(); onClose(); return; }
            if (event.key !== 'Tab') return;
            const items = focusables();
            if (!items.length) { event.preventDefault(); content?.focus(); return; }
            const first = items[0], last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
            previousFocus?.focus();
        };
    }, [open, onClose, closeOnEscape]);
    if (!open) return null;
    return createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/50 p-4" role="presentation" onMouseDown={event => { if (closeOnBackdrop && event.target === event.currentTarget) onClose(); }}>
            <div ref={contentRef} role={alert ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy} tabIndex={-1} className={`max-h-[calc(100dvh-2rem)] min-w-0 max-w-[calc(100vw-2rem)] overflow-y-auto ${className}`} onMouseDown={event => event.stopPropagation()}>
                {children}
            </div>
        </div>,
        document.body,
    );
}
