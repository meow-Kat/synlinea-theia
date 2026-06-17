/**
 * Backend DI module for usage-monitor.
 *
 * Binds: ClaudeUsageProvider, CodexUsageProvider, UsageServiceImpl,
 *        UsageService (alias), RPC ConnectionHandler.
 *
 * Pattern mirrors packages/skill-manager/src/node/skill-manager-backend-module.ts.
 */

import { ContainerModule } from 'inversify';
import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { UsageService, USAGE_SERVICE_PATH } from '../common/usage-protocol';
import { ClaudeUsageProvider } from './claude-usage-provider';
import { CodexUsageProvider } from './codex-usage-provider';
import { UsageServiceImpl } from './usage-service-impl';

export default new ContainerModule(bind => {
    bind(ClaudeUsageProvider).toSelf().inSingletonScope();
    bind(CodexUsageProvider).toSelf().inSingletonScope();
    bind(UsageServiceImpl).toSelf().inSingletonScope();
    bind(UsageService).toService(UsageServiceImpl);

    bind(ConnectionHandler)
        .toDynamicValue(ctx =>
            new RpcConnectionHandler(USAGE_SERVICE_PATH, () =>
                ctx.container.get<UsageService>(UsageService),
            ),
        )
        .inSingletonScope();
});
