/**
 * UT3 – ClaudeUsageProvider
 *
 * 1. Reads the OAuth access token from the macOS Keychain via `security find-generic-password`.
 * 2. Fetches https://api.anthropic.com/api/oauth/usage with the confirmed headers.
 * 3. Normalises the response into UsageWindow[] + ToolUsage.
 * 4. Caches the result for up to 60 s; on 429/error returns last cached value
 *    with stale:true, or available:false if no cache exists yet.
 *
 * SECURITY: The token is held in memory only; it is NEVER logged or written to disk.
 */

import * as child_process from 'child_process';
import { injectable } from 'inversify';
import { Severity, ToolUsage, UsageWindow } from '../common/usage-protocol';

const CACHE_TTL_MS = 60_000;
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';

// ── Raw API shapes ─────────────────────────────────────────────────────────────

interface RawWindowObject {
    utilization?: number;
    resets_at?: string;
}

interface RawLimitEntry {
    kind?: string;        // 'session' | 'weekly_all' | …
    percent?: number;
    severity?: string;    // 'normal' | 'warning' | 'critical'
    resets_at?: string;
    is_active?: boolean;
}

interface ClaudeUsageResponse {
    five_hour?: RawWindowObject;
    seven_day?: RawWindowObject;
    limits?: RawLimitEntry[];
}

// ── Cache entry ────────────────────────────────────────────────────────────────

interface CacheEntry {
    result: ToolUsage;
    fetchedAt: number;
}

// ── Provider ────────────────────────────────────────────────────────────────────

@injectable()
export class ClaudeUsageProvider {

    private cache: CacheEntry | undefined;

    /** Retrieve current Claude quota usage. */
    async getUsage(): Promise<ToolUsage> {
        const now = Date.now();
        if (this.cache && now - this.cache.fetchedAt < CACHE_TTL_MS) {
            return this.cache.result;
        }

        try {
            // 1. Read token from macOS Keychain — intentionally do not log the value.
            const token = await this.readKeychainToken();

            // 2. Fetch the usage endpoint.
            const response = await fetch(USAGE_URL, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'anthropic-beta': 'oauth-2025-04-20',
                    'anthropic-version': '2023-06-01',
                },
            });

            if (response.status === 429) {
                // Rate-limited — return stale cache or unavailable.
                return this.staleFallback();
            }

            if (!response.ok) {
                return this.staleFallback();
            }

            const data: ClaudeUsageResponse = await response.json() as ClaudeUsageResponse;
            const result = this.parseResponse(data);

            this.cache = { result, fetchedAt: Date.now() };
            return result;
        } catch {
            // Any error (network, JSON parse, keychain failure, etc.) → stale/unavailable.
            return this.staleFallback();
        }
    }

    // ── Token reading ───────────────────────────────────────────────────────────

    private readKeychainToken(): Promise<string> {
        return new Promise((resolve, reject) => {
            child_process.exec(
                'security find-generic-password -s "Claude Code-credentials" -w',
                { encoding: 'utf8' },
                (err, stdout) => {
                    if (err) {
                        reject(new Error('keychain-read-failed'));
                        return;
                    }
                    try {
                        const raw = stdout.trim();
                        const parsed = JSON.parse(raw) as Record<string, unknown>;
                        const oauth = parsed['claudeAiOauth'] as Record<string, unknown> | undefined;
                        const accessToken = oauth?.['accessToken'];
                        if (typeof accessToken !== 'string' || !accessToken) {
                            reject(new Error('token-not-found'));
                            return;
                        }
                        // SECURITY: do not log accessToken value
                        resolve(accessToken);
                    } catch {
                        reject(new Error('keychain-json-parse-failed'));
                    }
                },
            );
        });
    }

    // ── Response parsing ────────────────────────────────────────────────────────

    private parseResponse(data: ClaudeUsageResponse): ToolUsage {
        const windows: UsageWindow[] = [];

        // Prefer the limits[] array (contains percent + severity + resets_at directly).
        const limits = Array.isArray(data.limits) ? data.limits : [];

        // --- Session window (five_hour / kind≈session) ---
        const sessionLimit = limits.find(l =>
            typeof l.kind === 'string' && l.kind.toLowerCase().includes('session'),
        );
        if (sessionLimit) {
            windows.push({
                tool: 'claude',
                kind: 'session',
                percent: typeof sessionLimit.percent === 'number' ? sessionLimit.percent : 0,
                severity: this.normaliseSeverity(sessionLimit.severity),
                resetsAt: sessionLimit.resets_at ?? '',
                label: 'Session (5h)',
            });
        } else if (data.five_hour) {
            // Fallback to top-level five_hour object
            const pct = typeof data.five_hour.utilization === 'number'
                ? data.five_hour.utilization : 0;
            windows.push({
                tool: 'claude',
                kind: 'session',
                percent: pct,
                severity: this.severityFromPercent(pct),
                resetsAt: data.five_hour.resets_at ?? '',
                label: 'Session (5h)',
            });
        }

        // --- Weekly window (seven_day / kind≈weekly) ---
        const weeklyLimit = limits.find(l =>
            typeof l.kind === 'string' &&
            (l.kind.toLowerCase().includes('weekly') || l.kind.toLowerCase().includes('seven')),
        );
        if (weeklyLimit) {
            windows.push({
                tool: 'claude',
                kind: 'weekly',
                percent: typeof weeklyLimit.percent === 'number' ? weeklyLimit.percent : 0,
                severity: this.normaliseSeverity(weeklyLimit.severity),
                resetsAt: weeklyLimit.resets_at ?? '',
                label: 'Weekly (7d)',
            });
        } else if (data.seven_day) {
            // Fallback to top-level seven_day object
            const pct = typeof data.seven_day.utilization === 'number'
                ? data.seven_day.utilization : 0;
            windows.push({
                tool: 'claude',
                kind: 'weekly',
                percent: pct,
                severity: this.severityFromPercent(pct),
                resetsAt: data.seven_day.resets_at ?? '',
                label: 'Weekly (7d)',
            });
        }

        return {
            tool: 'claude',
            available: true,
            windows,
        };
    }

    // ── Utilities ───────────────────────────────────────────────────────────────

    private staleFallback(): ToolUsage {
        if (this.cache) {
            return { ...this.cache.result, stale: true };
        }
        return { tool: 'claude', available: false, windows: [] };
    }

    private normaliseSeverity(raw: string | undefined): Severity {
        switch ((raw ?? '').toLowerCase()) {
            case 'warning': return 'warning';
            case 'critical': return 'critical';
            default: return 'normal';
        }
    }

    private severityFromPercent(pct: number): Severity {
        if (pct >= 90) return 'critical';
        if (pct >= 70) return 'warning';
        return 'normal';
    }
}
