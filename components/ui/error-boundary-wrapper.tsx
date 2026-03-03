"use client";

import { ErrorBoundary } from "./error-boundary";

/**
 * Client-side wrapper for ErrorBoundary (a class component).
 * Needed because layout.tsx is a Server Component and can't
 * directly use the "use client" class component.
 */
export function ErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
    return <ErrorBoundary>{children}</ErrorBoundary>;
}
