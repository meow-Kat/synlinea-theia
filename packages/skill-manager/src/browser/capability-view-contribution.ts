import { injectable, inject } from 'inversify';
import {
    AbstractViewContribution,
    bindViewContribution,
    FrontendApplicationContribution,
} from '@theia/core/lib/browser';
import { CommandRegistry, CommandContribution } from '@theia/core/lib/common/command';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar/tab-bar-toolbar-registry';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { CapabilityTreeWidget } from './capability-tree-widget';
import { CapabilityInspectorWidget } from './capability-inspector-widget';
import { CapabilityScannerService } from '../common/capability-scanner-protocol';
import { interfaces } from 'inversify';

export const CAPABILITY_PANEL_REFRESH_COMMAND = {
    id: 'capability-panel.refresh',
    label: 'Refresh Capabilities',
    iconClass: 'codicon codicon-refresh',
};

@injectable()
export class CapabilityViewContribution
    extends AbstractViewContribution<CapabilityTreeWidget>
    implements FrontendApplicationContribution, CommandContribution, TabBarToolbarContribution {

    @inject(CapabilityScannerService)
    protected readonly scannerService: CapabilityScannerService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    constructor() {
        super({
            widgetId: CapabilityTreeWidget.ID,
            widgetName: CapabilityTreeWidget.LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 400,
            },
            toggleCommandId: 'capabilityPanel.toggle',
        });
    }

    async onStart(): Promise<void> {
        const treeWidget = await this.openView({ activate: false, reveal: false });
        // Subscribe to item selection — open/update the Inspector in the main area
        treeWidget.onDidSelectItem(async item => {
            const inspector = await this.widgetManager.getOrCreateWidget<CapabilityInspectorWidget>(
                CapabilityInspectorWidget.ID,
            );
            inspector.setItem(item);
            if (!inspector.isAttached) {
                this.shell.addWidget(inspector, { area: 'main' });
            }
            this.shell.activateWidget(inspector.id);
        });
        await this.refresh();
    }

    registerCommands(registry: CommandRegistry): void {
        super.registerCommands(registry);
        registry.registerCommand(CAPABILITY_PANEL_REFRESH_COMMAND, {
            execute: () => this.refresh(),
        });
    }

    registerToolbarItems(registry: TabBarToolbarRegistry): void {
        registry.registerItem({
            id: CAPABILITY_PANEL_REFRESH_COMMAND.id,
            command: CAPABILITY_PANEL_REFRESH_COMMAND.id,
            tooltip: 'Refresh Capabilities',
            group: 'navigation',
            isVisible: widget => !!widget && widget.id === CapabilityTreeWidget.ID,
        });
    }

    async refresh(): Promise<void> {
        const roots = await this.workspaceService.roots;
        const workspaceRoot = roots.length > 0
            ? roots[0].resource.path.toString()
            : undefined;

        const items = await this.scannerService.scan(workspaceRoot);

        const treeWidget = this.tryGetWidget();
        if (treeWidget) {
            treeWidget.setItems(items);
        }
    }
}

/** Helper to wire CapabilityViewContribution into a container module. */
export function bindCapabilityViewContribution(bind: interfaces.Bind): void {
    bindViewContribution(bind, CapabilityViewContribution);
    bind(FrontendApplicationContribution).toService(CapabilityViewContribution);
    bind(CommandContribution).toService(CapabilityViewContribution);
    bind(TabBarToolbarContribution).toService(CapabilityViewContribution);
}
