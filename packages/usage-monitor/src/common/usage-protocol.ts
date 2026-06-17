/**
 * UT2 – Common types + JSON-RPC service interface for the usage-monitor extension.
 *
 * UsageWindow  — one quota window (session or weekly) for one tool.
 * ToolUsage    — aggregated result per tool (Claude / Codex).
 * UsageService — backend service interface exposed via JSON-RPC.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type ToolName = 'claude' | 'codex';
export type WindowKind = 'session' | 'weekly';
export type Severity = 'normal' | 'warning' | 'critical';

/**
 * One quota window (session or weekly) for a tool.
 *
 * percent   – 0-100 utilization
 * severity  – normal (<70), warning (70-89), critical (≥90)
 * resetsAt  – ISO-8601 string (Claude) or Unix epoch seconds (Codex primary);
 *             callers should normalise to Date via `new Date(typeof x === 'number' ? x * 1000 : x)`
 * label     – human-readable label, e.g. "Session (5h)" or "Weekly"
 */
export interface UsageWindow {
    tool: ToolName;
    kind: WindowKind;
    percent: number;
    severity: Severity;
    resetsAt: string | number;
    label: string;
}

/**
 * Aggregated quota result for one tool.
 *
 * available          – false when data cannot be obtained (keychain fail / no session file)
 * stale              – true when returning last cached value after a backend error
 * windows            – list of quota windows; empty when available=false
 * planType           – plan name string from Codex rate_limits, if known
 * currentSessionTokens – last seen total_token_usage.total_tokens from Codex session
 */
export interface ToolUsage {
    tool: ToolName;
    available: boolean;
    stale?: boolean;
    windows: UsageWindow[];
    planType?: string;
    currentSessionTokens?: number;
}

// ── JSON-RPC service ────────────────────────────────────────────────────────────

/** JSON-RPC path for the usage backend service. */
export const USAGE_SERVICE_PATH = '/services/usage-monitor';

/** Injection token for the usage service. */
export const UsageService = Symbol('UsageService');

/** Backend service that aggregates quota data from Claude and Codex providers. */
export interface UsageService {
    /**
     * Return current quota usage for all available tools.
     * Results are cached (max 60 s); stale values are returned on backend error.
     */
    getUsage(): Promise<ToolUsage[]>;
}
