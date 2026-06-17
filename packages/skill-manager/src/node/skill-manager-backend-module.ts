import { ContainerModule } from 'inversify';
import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { CapabilityScannerService, CAPABILITY_SCANNER_SERVICE_PATH } from '../common/capability-scanner-protocol';
import { CapabilityScannerServiceImpl } from './capability-scanner-service-impl';

export default new ContainerModule(bind => {
    bind(CapabilityScannerServiceImpl).toSelf().inSingletonScope();
    bind(CapabilityScannerService).toService(CapabilityScannerServiceImpl);

    bind(ConnectionHandler)
        .toDynamicValue(ctx =>
            new RpcConnectionHandler(CAPABILITY_SCANNER_SERVICE_PATH, () =>
                ctx.container.get<CapabilityScannerService>(CapabilityScannerService),
            ),
        )
        .inSingletonScope();
});
