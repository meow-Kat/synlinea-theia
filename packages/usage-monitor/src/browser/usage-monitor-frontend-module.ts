/**
 * Frontend DI module for usage-monitor.
 *
 * Binds:
 *   - RPC proxy to backend UsageService (reused from UT5, unchanged)
 *   - UsageToolTerminalContribution (command + keybinding + status-bar quota)
 *
 * Pattern mirrors packages/skill-manager/src/browser/skill-manager-frontend-module.ts.
 *
 * NOTE: The old UsageStripWidget (bottom-panel tab) and the always-on strip
 * are removed per the 2026-06-17 design revision.  The CSS file is retained
 * so the build does not break if it is referenced elsewhere, but it is no
 * longer imported here.
 */

import { ContainerModule } from 'inversify';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser/messaging/ws-connection-provider';
import { UsageService, USAGE_SERVICE_PATH } from '../common/usage-protocol';
import { bindUsageToolTerminalContribution } from './usage-tool-terminal-contribution';

export default new ContainerModule(bind => {
    // ── RPC proxy to backend service ──────────────────────────────────────────
    bind(UsageService)
        .toDynamicValue(ctx =>
            WebSocketConnectionProvider.createProxy<UsageService>(
                ctx.container,
                USAGE_SERVICE_PATH,
            ),
        )
        .inSingletonScope();

    // ── Command + keybinding + status-bar quota ───────────────────────────────
    bindUsageToolTerminalContribution(bind);
});
