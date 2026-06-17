/**
 * UT9 — Unit tests for the Codex usage parser (CodexUsageProvider).
 *
 * Covers (per docs/plans/v3-usage-quota-panel.md §測試計畫):
 *   Codex rollout-*.jsonl rate_limits normalisation →
 *     - primary (window_minutes=10080)         → kind 'weekly', percent, resetsAt (epoch s)
 *     - secondary (null)                        → omitted (no session window)
 *     - secondary (present)                     → kind 'session'
 *     - plan_type / total_token_usage           → planType / currentSessionTokens
 *   Fault tolerance:
 *     - no rate_limits line                     → available:false (via parseContent)
 *     - no session files on disk                → available:false (via getUsage + $HOME stub)
 *     - last rate_limits line wins (backward scan)
 *
 * Isolation strategy (NO live I/O):
 *   The normalisation logic lives in the PRIVATE `parseContent(content)` method,
 *   which takes a raw JSONL string — no fs needed. We invoke it via a typed cast
 *   (`private` is compile-time only) with fixture JSONL strings.
 *   For the file-discovery path we drive the public `getUsage()` against a temp
 *   tree pointed at by $HOME (os.homedir() reads $HOME on POSIX) so we never touch
 *   the real ~/.codex. We do NOT reassign os.homedir (getter-only under ESM).
 *
 * NOTE (testability follow-up for the coder, not done here):
 *   `parseContent` is `private` on CodexUsageProvider, reached here via a cast.
 *   Exporting a pure `parseCodexRateLimits(content|obj): ToolUsage` free function
 *   would let this be imported and tested directly without the cast.
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as nodePath from 'path';
import { CodexUsageProvider } from '../src/node/codex-usage-provider';
import { ToolUsage, UsageWindow } from '../src/common/usage-protocol';

/** Minimal structural type for reaching the private parser without `any`-noise. */
interface ParseAccessor {
    parseContent(content: string): ToolUsage;
}

function parse(content: string): ToolUsage {
    const provider = new CodexUsageProvider();
    return (provider as unknown as ParseAccessor).parseContent(content);
}

function windowOf(usage: ToolUsage, kind: 'session' | 'weekly'): UsageWindow | undefined {
    return usage.windows.find(w => w.kind === kind);
}

/** Build a Codex event JSONL line carrying a rate_limits payload (nested one level). */
function rateLimitsLine(rateLimits: unknown): string {
    return JSON.stringify({
        timestamp: '2026-06-17T00:00:00Z',
        type: 'event',
        payload: { rate_limits: rateLimits },
    });
}

/** Build a Codex event JSONL line carrying total_token_usage. */
function tokenUsageLine(totalTokens: number): string {
    return JSON.stringify({
        timestamp: '2026-06-17T00:00:01Z',
        type: 'event',
        payload: { total_token_usage: { total_tokens: totalTokens } },
    });
}

describe('CodexUsageProvider.parseContent', () => {

    describe('confirmed rollout fixture (primary weekly, secondary null)', () => {

        // Confirmed probe shape: primary used_percent 4.0 over a 10080-min (weekly)
        // window, secondary null, plan_type 'free', plus a total_token_usage event.
        const content = [
            tokenUsageLine(12345),
            rateLimitsLine({
                limit_id: 'codex',
                primary: { used_percent: 4.0, window_minutes: 10080, resets_at: 1779248506 },
                secondary: null,
                plan_type: 'free',
            }),
        ].join('\n');

        let usage: ToolUsage;
        before(() => {
            usage = parse(content);
        });

        it('marks the tool available and tagged codex', () => {
            expect(usage.tool).to.equal('codex');
            expect(usage.available).to.equal(true);
        });

        it('maps primary → a single weekly window at 4%', () => {
            const weekly = windowOf(usage, 'weekly');
            expect(weekly, 'weekly window').to.not.equal(undefined);
            expect(weekly!.tool).to.equal('codex');
            expect(weekly!.percent).to.equal(4);
            expect(weekly!.severity).to.equal('normal'); // 4 → normal
        });

        it('parses the weekly resetsAt as the raw epoch-seconds number', () => {
            const weekly = windowOf(usage, 'weekly')!;
            expect(weekly.resetsAt).to.equal(1779248506);
            expect(typeof weekly.resetsAt).to.equal('number');
        });

        it('omits the session window when secondary is null', () => {
            expect(windowOf(usage, 'session')).to.equal(undefined);
            expect(usage.windows).to.have.length(1);
        });

        it('captures plan_type and total_token_usage', () => {
            expect(usage.planType).to.equal('free');
            expect(usage.currentSessionTokens).to.equal(12345);
        });
    });

    describe('secondary present → session window', () => {

        let usage: ToolUsage;
        before(() => {
            usage = parse(rateLimitsLine({
                limit_id: 'codex',
                primary: { used_percent: 50, window_minutes: 10080, resets_at: 100 },
                secondary: { used_percent: 75, window_minutes: 300, resets_at: 200 },
                plan_type: 'pro',
            }));
        });

        it('emits both a weekly and a session window', () => {
            expect(usage.windows).to.have.length(2);
            const weekly = windowOf(usage, 'weekly')!;
            const session = windowOf(usage, 'session')!;
            expect(weekly.percent).to.equal(50);
            expect(session.percent).to.equal(75);
        });

        it('derives severity from percent (75 → warning)', () => {
            expect(windowOf(usage, 'session')!.severity).to.equal('warning');
            expect(windowOf(usage, 'weekly')!.severity).to.equal('normal');
        });
    });

    describe('fault tolerance', () => {

        it('returns available:false when there is no rate_limits line', () => {
            const usage = parse([
                tokenUsageLine(99),
                JSON.stringify({ type: 'message', payload: { text: 'hello' } }),
            ].join('\n'));
            expect(usage.tool).to.equal('codex');
            expect(usage.available).to.equal(false);
            expect(usage.windows).to.have.length(0);
        });

        it('returns available:false for empty content', () => {
            const usage = parse('');
            expect(usage.available).to.equal(false);
        });

        it('skips malformed JSON lines without crashing', () => {
            const usage = parse([
                '{ this is not json',
                rateLimitsLine({ primary: { used_percent: 9, resets_at: 7 }, secondary: null }),
            ].join('\n'));
            expect(usage.available).to.equal(true);
            expect(windowOf(usage, 'weekly')!.percent).to.equal(9);
        });

        it('defaults percent to 0 and resetsAt to 0 when fields are missing', () => {
            const usage = parse(rateLimitsLine({ primary: {}, secondary: null }));
            const weekly = windowOf(usage, 'weekly')!;
            expect(weekly.percent).to.equal(0);
            expect(weekly.resetsAt).to.equal(0);
        });

        it('uses the LAST rate_limits line (backward scan wins)', () => {
            const usage = parse([
                rateLimitsLine({ primary: { used_percent: 10, resets_at: 1 }, secondary: null }),
                rateLimitsLine({ primary: { used_percent: 88, resets_at: 2 }, secondary: null }),
            ].join('\n'));
            // backward scan picks the most recent (last) line.
            expect(windowOf(usage, 'weekly')!.percent).to.equal(88);
        });
    });
});

describe('CodexUsageProvider.getUsage (file discovery, $HOME-stubbed, no real ~/.codex)', () => {

    let tmpRoot: string;
    let fakeHome: string;
    let originalHome: string | undefined;

    before(() => {
        tmpRoot = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'synlinea-ut9-codex-'));
        fakeHome = nodePath.join(tmpRoot, 'home');
        fs.mkdirSync(fakeHome, { recursive: true });
        // os.homedir() reads $HOME on POSIX; redirect into the temp tree.
        // NB: reassigning os.homedir fails under ESM (getter-only), so override $HOME.
        originalHome = process.env.HOME;
        process.env.HOME = fakeHome;
    });

    after(() => {
        if (originalHome === undefined) {
            delete process.env.HOME;
        } else {
            process.env.HOME = originalHome;
        }
        if (tmpRoot) {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        }
    });

    it('returns available:false when no ~/.codex/sessions exists', async () => {
        const usage = await new CodexUsageProvider().getUsage();
        expect(usage.tool).to.equal('codex');
        expect(usage.available).to.equal(false);
        expect(usage.windows).to.have.length(0);
    });

    it('discovers the latest rollout file and parses its rate_limits', async () => {
        const sessionsDir = nodePath.join(fakeHome, '.codex', 'sessions', '2026', '06', '17');
        fs.mkdirSync(sessionsDir, { recursive: true });
        fs.writeFileSync(
            nodePath.join(sessionsDir, 'rollout-2026-06-17T00-00-00.jsonl'),
            [
                tokenUsageLine(555),
                rateLimitsLine({
                    limit_id: 'codex',
                    primary: { used_percent: 4.0, window_minutes: 10080, resets_at: 1779248506 },
                    secondary: null,
                    plan_type: 'free',
                }),
            ].join('\n'),
            'utf8',
        );

        const usage = await new CodexUsageProvider().getUsage();
        expect(usage.available).to.equal(true);
        expect(usage.windows.find(w => w.kind === 'weekly')!.percent).to.equal(4);
        expect(usage.planType).to.equal('free');
        expect(usage.currentSessionTokens).to.equal(555);
    });
});
