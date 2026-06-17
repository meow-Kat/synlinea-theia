/**
 * UT5 – UsageServiceImpl
 *
 * Aggregates ClaudeUsageProvider + CodexUsageProvider and exposes the result
 * via Theia JSON-RPC (see usage-monitor-backend-module.ts for the RPC wiring).
 */

import { injectable, inject } from 'inversify';
import { ToolUsage, UsageService } from '../common/usage-protocol';
import { ClaudeUsageProvider } from './claude-usage-provider';
import { CodexUsageProvider } from './codex-usage-provider';

@injectable()
export class UsageServiceImpl implements UsageService {

    @inject(ClaudeUsageProvider)
    protected readonly claudeProvider: ClaudeUsageProvider;

    @inject(CodexUsageProvider)
    protected readonly codexProvider: CodexUsageProvider;

    /**
     * Return current quota usage for all tools.
     * Both providers are queried in parallel; individual failures
     * produce `available:false` entries rather than rejecting the whole call.
     */
    async getUsage(): Promise<ToolUsage[]> {
        const [claude, codex] = await Promise.all([
            this.safeGet(() => this.claudeProvider.getUsage(), 'claude'),
            this.safeGet(() => this.codexProvider.getUsage(), 'codex'),
        ]);
        return [claude, codex];
    }

    private async safeGet(
        fn: () => Promise<ToolUsage>,
        tool: 'claude' | 'codex',
    ): Promise<ToolUsage> {
        try {
            return await fn();
        } catch {
            return { tool, available: false, windows: [] };
        }
    }
}
