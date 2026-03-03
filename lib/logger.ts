/**
 * Structured logger with JSON output and request ID support.
 * Replaces raw console.error/log for traceability.
 */

import { randomBytes } from "crypto";

export type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    requestId?: string;
    userId?: string;
    [key: string]: unknown;
}

class Logger {
    private write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...meta,
        };

        const json = JSON.stringify(entry);

        switch (level) {
            case "error":
                console.error(json);
                break;
            case "warn":
                console.warn(json);
                break;
            case "debug":
                if (process.env.NODE_ENV !== "production") console.debug(json);
                break;
            default:
                console.log(json);
        }
    }

    info(message: string, meta?: Record<string, unknown>) {
        this.write("info", message, meta);
    }

    warn(message: string, meta?: Record<string, unknown>) {
        this.write("warn", message, meta);
    }

    error(message: string, meta?: Record<string, unknown>) {
        this.write("error", message, meta);
    }

    debug(message: string, meta?: Record<string, unknown>) {
        this.write("debug", message, meta);
    }
}

export const logger = new Logger();

/**
 * Generate a unique request ID for tracing.
 */
export function generateRequestId(): string {
    return randomBytes(8).toString("hex");
}
