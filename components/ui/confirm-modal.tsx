"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "default";
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmModal({
    open, title, message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "default",
    onConfirm, onCancel,
}: Props) {
    const confirmRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (open) {
            confirmRef.current?.focus();
            const handler = (e: KeyboardEvent) => {
                if (e.key === "Escape") onCancel();
            };
            window.addEventListener("keydown", handler);
            return () => window.removeEventListener("keydown", handler);
        }
    }, [open, onCancel]);

    if (!open) return null;

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="modal-title">{title}</h3>
                <p className="modal-message">{message}</p>
                <div className="modal-actions">
                    <button className="btn-secondary btn-sm" onClick={onCancel}>
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmRef}
                        className={`btn-sm ${variant === "danger" ? "btn-danger" : "btn-primary"}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

/** Hook for easy modal usage */
export function useConfirm() {
    const [state, setState] = useState<{
        open: boolean;
        title: string;
        message: string;
        variant: "danger" | "default";
        resolve: ((v: boolean) => void) | null;
    }>({ open: false, title: "", message: "", variant: "default", resolve: null });

    function confirm(title: string, message: string, variant: "danger" | "default" = "default"): Promise<boolean> {
        return new Promise((resolve) => {
            setState({ open: true, title, message, variant, resolve });
        });
    }

    function handleConfirm() {
        state.resolve?.(true);
        setState((s) => ({ ...s, open: false }));
    }

    function handleCancel() {
        state.resolve?.(false);
        setState((s) => ({ ...s, open: false }));
    }

    const modal = (
        <ConfirmModal
            open={state.open}
            title={state.title}
            message={state.message}
            variant={state.variant}
            confirmLabel={state.variant === "danger" ? "Delete" : "Confirm"}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
    );

    return { confirm, modal };
}
