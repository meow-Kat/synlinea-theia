/**
 * UT4 – CodexUsageProvider
 *
 * Finds the most recently modified rollout-*.jsonl file under
 *   ~/.codex/sessions/.../rollout-*.jsonl  (recursive)
 *   ~/.codex/archived_sessions/.../rollout-*.jsonl  (recursive)
 *
 * Reads the file and scans BACKWARD for the last JSONL line that contains a
 * `rate_limits` field.  Also picks up the last `total_token_usage.total_tokens`.
 *
 * Confirmed shape (from live probe 2026-06-17):
 *   rate_limits: {
 *     limit_id: "codex",
 *     primary: { used_percent: 4.0, window_minutes: 10080, resets_at: <epoch-s> },
 *     secondary: null | { used_percent, window_minutes, resets_at },
 *     plan_type: "free"
 *   }
 *
 * primary (window_minutes=10080 → weekly) → kind:'weekly'
 * secondary (if present)                  → kind:'session'
 * No files / no rate_limits line          → available:false
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { injectable } from 'inversify';
import { Severity, ToolUsage, UsageWindow } from '../common/usage-protocol';

// ── Raw shapes ─────────────────────────────────────────────────────────────────

interface RawRateLimitWindow {
    used_percent?: number;
    window_minutes?: number;
    resets_at?: number;   // Unix epoch seconds
}

interface RawRateLimits {
    limit_id?: string;
    primary?: RawRateLimitWindow | null;
    secondary?: RawRateLimitWindow | null;
    plan_type?: string;
}

interface RawTotalTokenUsage {
    total_tokens?: number;
}

// ── Provider ────────────────────────────────────────────────────────────────────

@injectable()
export class CodexUsageProvider {

    /** Retrieve current Codex quota usage from the latest session file. */
    async getUsage(): Promise<ToolUsage> {
        try {
            const filePath = await this.findLatestRolloutFile();
            if (!filePath) {
                return { tool: 'codex', available: false, windows: [] };
            }

            const content = fs.readFileSync(filePath, 'utf8');
            return this.parseContent(content);
        } catch {
            return { tool: 'codex', available: false, windows: [] };
        }
    }

    // ── File discovery ──────────────────────────────────────────────────────────

    private async findLatestRolloutFile(): Promise<string | undefined> {
        const home = os.homedir();
        const roots = [
            path.join(home, '.codex', 'sessions'),
            path.join(home, '.codex', 'archived_sessions'),
        ];

        let latest: { path: string; mtime: number } | undefined;

        for (const root of roots) {
            if (!fs.existsSync(root)) continue;
            const candidates = this.globRolloutFiles(root);
            for (const f of candidates) {
                try {
                    const stat = fs.statSync(f);
                    if (!latest || stat.mtimeMs > latest.mtime) {
                        latest = { path: f, mtime: stat.mtimeMs };
                    }
                } catch {
                    // stat failed — skip
                }
            }
        }

        return latest?.path;
    }

    /**
     * Recursively find all rollout-*.jsonl files under `dir`.
     * We use a manual walk (no glob dep) to keep this package dep-free.
     */
    private globRolloutFiles(dir: string): string[] {
        const results: string[] = [];
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    results.push(...this.globRolloutFiles(full));
                } else if (entry.isFile() && /^rollout-.*\.jsonl$/i.test(entry.name)) {
                    results.push(full);
                }
            }
        } catch {
            // unreadable dir — skip
        }
        return results;
    }

    // ── Content parsing ─────────────────────────────────────────────────────────

    private parseContent(content: string): ToolUsage {
        const lines = content.split('\n').filter(l => l.trim().length > 0);

        let lastRateLimits: RawRateLimits | undefined;
        let lastTotalTokens: number | undefined;

        // Scan backward — find the most recent event with rate_limits / total_token_usage.
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            if (!lastRateLimits && line.includes('rate_limits')) {
                try {
                    const obj = JSON.parse(line) as Record<string, unknown>;
                    const rl = this.dig(obj, 'rate_limits');
                    if (rl) lastRateLimits = rl as RawRateLimits;
                } catch {
                    // bad JSON line — skip
                }
            }
            if (lastTotalTokens === undefined && line.includes('total_token_usage')) {
                try {
                    const obj = JSON.parse(line) as Record<string, unknown>;
                    const tu = this.dig(obj, 'total_token_usage') as RawTotalTokenUsage | undefined;
                    if (tu && typeof tu.total_tokens === 'number') {
                        lastTotalTokens = tu.total_tokens;
                    }
                } catch {
                    // bad JSON line — skip
                }
            }
            if (lastRateLimits !== undefined && lastTotalTokens !== undefined) break;
        }

        if (!lastRateLimits) {
            return { tool: 'codex', available: false, windows: [] };
        }

        return this.buildToolUsage(lastRateLimits, lastTotalTokens);
    }

    private buildToolUsage(rl: RawRateLimits, totalTokens: number | undefined): ToolUsage {
        const windows: UsageWindow[] = [];

        // primary → weekly (window_minutes = 10080)
        if (rl.primary) {
            const pct = typeof rl.primary.used_percent === 'number' ? rl.primary.used_percent : 0;
            windows.push({
                tool: 'codex',
                kind: 'weekly',
                percent: pct,
                severity: this.severityFromPercent(pct),
                resetsAt: rl.primary.resets_at ?? 0,
                label: 'Weekly (7d)',
            });
        }

        // secondary → session (may be null)
        if (rl.secondary) {
            const pct = typeof rl.secondary.used_percent === 'number' ? rl.secondary.used_percent : 0;
            windows.push({
                tool: 'codex',
                kind: 'session',
                percent: pct,
                severity: this.severityFromPercent(pct),
                resetsAt: rl.secondary.resets_at ?? 0,
                label: 'Session',
            });
        }

        const result: ToolUsage = {
            tool: 'codex',
            available: true,
            windows,
            planType: typeof rl.plan_type === 'string' ? rl.plan_type : undefined,
        };

        if (typeof totalTokens === 'number') {
            result.currentSessionTokens = totalTokens;
        }

        return result;
    }

    // ── Utilities ───────────────────────────────────────────────────────────────

    /** Traverse `obj` following dot-separated or nested keys. */
    private dig(obj: Record<string, unknown>, key: string): unknown {
        if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
        // Also try nested one level deep (the event may be wrapped)
        for (const v of Object.values(obj)) {
            if (v && typeof v === 'object') {
                const inner = v as Record<string, unknown>;
                if (Object.prototype.hasOwnProperty.call(inner, key)) {
                    return inner[key];
                }
            }
        }
        return undefined;
    }

    private severityFromPercent(pct: number): Severity {
        if (pct >= 90) return 'critical';
        if (pct >= 70) return 'warning';
        return 'normal';
    }
}
