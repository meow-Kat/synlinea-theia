/**
 * UT9 — Unit tests for the Claude usage parser (ClaudeUsageProvider).
 *
 * Covers (per docs/plans/v3-usage-quota-panel.md §測試計畫):
 *   Claude `/api/oauth/usage` response normalisation →
 *     - session window (five_hour / kind≈session)  → kind 'session', percent, resetsAt
 *     - weekly window (seven_day / kind≈weekly_all) → kind 'weekly', percent, severity, resetsAt
 *   Fault tolerance:
 *     - limits[] present → percent + severity taken from limits entries
 *     - limits[] missing → fall back to top-level five_hour / seven_day objects
 *     - missing fields  → percent defaults to 0, resetsAt to '', no crash
 *     - empty / unknown response → available:true with empty windows
 *
 * Isolation strategy (NO live I/O):
 *   The real `getUsage()` reads the macOS Keychain (`security` exec) and calls
 *   `fetch()` against the live endpoint. The normalisation logic lives in the
 *   PRIVATE `parseResponse(data)` method. We never call `getUsage()`; instead we
 *   instantiate the provider and invoke `parseResponse` directly via a typed cast
 *   (`private` is compile-time only). This exercises the real parse/normalise code
 *   with a fixture object and zero network / keychain / fs access.
 *
 * NOTE (testability follow-up for the coder, not done here):
 *   `parseResponse` is `private` on ClaudeUsageProvider, so we reach it via a cast.
 *   Exporting a pure `parseClaudeUsage(json): ToolUsage` free function would let
 *   this be imported and tested directly without the cast.
 */

import { expect } from 'chai';
import { ClaudeUsageProvider } from '../src/node/claude-usage-provider';
import { ToolUsage, UsageWindow } from '../src/common/usage-protocol';

/** Minimal structural type for reaching the private parser without `any`-noise. */
interface ParseAccessor {
    parseResponse(data: unknown): ToolUsage;
}

function parse(data: unknown): ToolUsage {
    const provider = new ClaudeUsageProvider();
    return (provider as unknown as ParseAccessor).parseResponse(data);
}

function windowOf(usage: ToolUsage, kind: 'session' | 'weekly'): UsageWindow | undefined {
    return usage.windows.find(w => w.kind === kind);
}

describe('ClaudeUsageProvider.parseResponse', () => {

    describe('confirmed /api/oauth/usage fixture (limits[] present)', () => {

        // The confirmed probe shape: five_hour/seven_day top-level + a limits[] array
        // carrying percent + severity + resets_at + is_active per kind.
        const fixture = {
            five_hour: { utilization: 28.0, resets_at: '2026-06-17T10:59:59Z' },
            seven_day: { utilization: 81.0, resets_at: '2026-06-18T02:59:59Z' },
            limits: [
                {
                    kind: 'session',
                    percent: 28,
                    severity: 'normal',
                    resets_at: '2026-06-17T10:59:59Z',
                    is_active: false,
                },
                {
                    kind: 'weekly_all',
                    percent: 81,
                    severity: 'warning',
                    resets_at: '2026-06-18T02:59:59Z',
                    is_active: true,
                },
            ],
        };

        let usage: ToolUsage;
        before(() => {
            usage = parse(fixture);
        });

        it('marks the tool available and tagged claude', () => {
            expect(usage.tool).to.equal('claude');
            expect(usage.available).to.equal(true);
        });

        it('emits exactly two windows: a session + a weekly', () => {
            expect(usage.windows).to.have.length(2);
            expect(windowOf(usage, 'session'), 'session window').to.not.equal(undefined);
            expect(windowOf(usage, 'weekly'), 'weekly window').to.not.equal(undefined);
        });

        it('normalises the session window from the limits[] session entry (28%)', () => {
            const session = windowOf(usage, 'session')!;
            expect(session.tool).to.equal('claude');
            expect(session.percent).to.equal(28);
            // limits[] severity is taken verbatim, not derived from percent.
            expect(session.severity).to.equal('normal');
            expect(session.resetsAt).to.equal('2026-06-17T10:59:59Z');
        });

        it('normalises the weekly window from weekly_all (81%, warning severity)', () => {
            const weekly = windowOf(usage, 'weekly')!;
            expect(weekly.tool).to.equal('claude');
            expect(weekly.percent).to.equal(81);
            // severity comes from the limits entry ('warning'), preserved verbatim.
            expect(weekly.severity).to.equal('warning');
            expect(weekly.resetsAt).to.equal('2026-06-18T02:59:59Z');
        });
    });

    describe('fault tolerance: limits[] missing → fall back to five_hour / seven_day', () => {

        let usage: ToolUsage;
        before(() => {
            usage = parse({
                five_hour: { utilization: 28.0, resets_at: '2026-06-17T10:59:59Z' },
                seven_day: { utilization: 81.0, resets_at: '2026-06-18T02:59:59Z' },
                // no limits[]
            });
        });

        it('still produces a session + weekly window', () => {
            expect(windowOf(usage, 'session'), 'session window').to.not.equal(undefined);
            expect(windowOf(usage, 'weekly'), 'weekly window').to.not.equal(undefined);
        });

        it('takes percent / resetsAt from the top-level utilization objects', () => {
            const session = windowOf(usage, 'session')!;
            expect(session.percent).to.equal(28);
            expect(session.resetsAt).to.equal('2026-06-17T10:59:59Z');

            const weekly = windowOf(usage, 'weekly')!;
            expect(weekly.percent).to.equal(81);
            expect(weekly.resetsAt).to.equal('2026-06-18T02:59:59Z');
        });

        it('derives severity from percent when no limits[] severity is present', () => {
            // fallback path uses severityFromPercent: <70 normal, 70-89 warning, >=90 critical.
            expect(windowOf(usage, 'session')!.severity).to.equal('normal'); // 28 → normal
            expect(windowOf(usage, 'weekly')!.severity).to.equal('warning'); // 81 → warning
        });
    });

    describe('fault tolerance: missing fields', () => {

        it('defaults percent to 0 and resetsAt to "" when utilization/resets_at absent', () => {
            const usage = parse({
                five_hour: {},   // no utilization, no resets_at
                seven_day: {},
            });
            const session = windowOf(usage, 'session')!;
            expect(session.percent).to.equal(0);
            expect(session.resetsAt).to.equal('');
            expect(session.severity).to.equal('normal'); // 0 → normal
        });

        it('handles a limits[] entry missing percent (defaults to 0)', () => {
            const usage = parse({
                limits: [
                    { kind: 'session', severity: 'normal', resets_at: 'x' }, // no percent
                ],
            });
            const session = windowOf(usage, 'session')!;
            expect(session.percent).to.equal(0);
            expect(session.resetsAt).to.equal('x');
        });

        it('produces available:true with empty windows for an empty response', () => {
            const usage = parse({});
            expect(usage.tool).to.equal('claude');
            expect(usage.available).to.equal(true);
            expect(usage.windows).to.have.length(0);
        });

        it('omits the session window when only weekly data exists', () => {
            const usage = parse({
                seven_day: { utilization: 50, resets_at: 'r' },
            });
            expect(windowOf(usage, 'session')).to.equal(undefined);
            expect(windowOf(usage, 'weekly')).to.not.equal(undefined);
        });
    });

    describe('severity normalisation from limits[] strings', () => {

        it('maps warning / critical verbatim and unknown → normal', () => {
            const usage = parse({
                limits: [
                    { kind: 'session', percent: 95, severity: 'critical', resets_at: 'a' },
                    { kind: 'weekly_all', percent: 10, severity: 'bogus-value', resets_at: 'b' },
                ],
            });
            expect(windowOf(usage, 'session')!.severity).to.equal('critical');
            // unrecognised severity string falls back to 'normal' (not derived from percent here).
            expect(windowOf(usage, 'weekly')!.severity).to.equal('normal');
        });
    });
});
