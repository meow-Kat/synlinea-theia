import '../../src/browser/style/capability-panel.css';
import { ContainerModule } from 'inversify';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser/messaging/ws-connection-provider';
import { WidgetFactory } from '@theia/core/lib/browser/widget-manager';
import { CapabilityScannerService, CAPABILITY_SCANNER_SERVICE_PATH } from '../common/capability-scanner-protocol';
import { CapabilityTreeWidget } from './capability-tree-widget';
import { CapabilityInspectorWidget } from './capability-inspector-widget';
import { bindCapabilityViewContribution } from './capability-view-contribution';

export default new ContainerModule(bind => {
    // ── RPC proxy to backend scanner service ──────────────────────────────────
    bind(CapabilityScannerService)
        .toDynamicValue(ctx =>
            WebSocketConnectionProvider.createProxy<CapabilityScannerService>(
                ctx.container,
                CAPABILITY_SCANNER_SERVICE_PATH,
            ),
        )
        .inSingletonScope();

    // ── Inspector widget (right side) ─────────────────────────────────────────
    // MarkdownRenderer is already bound by @theia/core frontend module;
    // CapabilityInspectorWidget injects it via @inject(MarkdownRenderer).
    bind(CapabilityInspectorWidget).toSelf().inSingletonScope();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: CapabilityInspectorWidget.ID,
        createWidget: () => ctx.container.get(CapabilityInspectorWidget),
    })).inSingletonScope();

    // ── Tree widget (left panel) ──────────────────────────────────────────────
    bind(CapabilityTreeWidget).toSelf().inSingletonScope();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: CapabilityTreeWidget.ID,
        createWidget: () => ctx.container.get(CapabilityTreeWidget),
    })).inSingletonScope();

    // ── View contribution: registers left-panel, commands, toolbar Refresh ────
    bindCapabilityViewContribution(bind);
});
