"use client";

import { useEffect, useState } from "react";

interface Toast {
    id: number;
    message: string;
    type: "success" | "error" | "info";
}

let toastId = 0;
const listeners: Set<(t: Toast) => void> = new Set();

export function showToast(message: string, type: "success" | "error" | "info" = "info") {
    const toast: Toast = { id: ++toastId, message, type };
    listeners.forEach((fn) => fn(toast));
}

export function ToastContainer() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        const handler = (t: Toast) => {
            setToasts((prev) => [...prev, t]);
            setTimeout(() => {
                setToasts((prev) => prev.filter((x) => x.id !== t.id));
            }, 3000);
        };
        listeners.add(handler);
        return () => { listeners.delete(handler); };
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div className="toast-container">
            {toasts.map((t) => (
                <div key={t.id} className={`toast toast-${t.type}`}>
                    {t.message}
                </div>
            ))}
        </div>
    );
}
