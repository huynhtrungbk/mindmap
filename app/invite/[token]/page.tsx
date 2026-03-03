"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface PageProps {
    params: Promise<{ token: string }>;
}

export default function InvitePage({ params }: PageProps) {
    const router = useRouter();
    const [status, setStatus] = useState<"loading" | "error">("loading");
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        async function acceptInvite() {
            try {
                const { token } = await params;
                const res = await fetch(`/api/invite/${token}`);

                if (res.redirected) {
                    // Follow the redirect
                    router.replace(new URL(res.url).pathname);
                    return;
                }

                if (!res.ok) {
                    const data = await res.json().catch(() => ({ error: "Unknown error" }));
                    setErrorMsg(data.error || "Failed to accept invitation");
                    setStatus("error");
                    return;
                }

                // Fallback: redirect to dashboard
                router.replace("/dashboard");
            } catch {
                setErrorMsg("Network error. Please try again.");
                setStatus("error");
            }
        }

        acceptInvite();
    }, [params, router]);

    if (status === "error") {
        return (
            <main className="dashboard-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
                <div style={{ textAlign: "center" }}>
                    <h2 style={{ marginBottom: "12px" }}>❌ Invitation Failed</h2>
                    <p style={{ color: "var(--color-text-muted)", marginBottom: "16px" }}>{errorMsg}</p>
                    <button className="btn-primary" onClick={() => router.push("/dashboard")}>
                        Go to Dashboard
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="dashboard-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
            <div style={{ textAlign: "center" }}>
                <h2>🔄 Accepting invitation…</h2>
                <p style={{ color: "var(--color-text-muted)" }}>Please wait while we set up your access.</p>
            </div>
        </main>
    );
}
