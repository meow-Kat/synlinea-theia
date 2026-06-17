import * as React from 'react';
import { injectable, postConstruct } from 'inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { CapabilityItem } from '../common/capability-item';

/**
 * VT6 – Left-side two-layer tree widget.
 *
 * Layout:
 *   [Search box]
 *   ▾ GLOBAL (~/.claude)
 *     ▾ Skills (n)
 *        <item>…
 *     ▾ Rules (n)
 *        <item>…
 *   ▾ PROJECT (<workspace>)
 *     ▾ Skills (n)
 *     ▾ Rules (n)
 */
@injectable()
export class CapabilityTreeWidget extends ReactWidget {

    static readonly ID = 'capability-tree';
    static readonly LABEL = 'Capabilities';

    private items: CapabilityItem[] = [];
    private filter = '';
    private selectedItem: CapabilityItem | undefined;
    private expandedGroups = new Set<string>([
        'global-skills', 'global-rules', 'project-skills', 'project-rules',
    ]);

    private readonly onDidSelectItemEmitter = new Emitter<CapabilityItem>();
    /** Fires when the user selects an item in the tree. */
    readonly onDidSelectItem: Event<CapabilityItem> = this.onDidSelectItemEmitter.event;

    @postConstruct()
    protected init(): void {
        this.id = CapabilityTreeWidget.ID;
        this.title.label = CapabilityTreeWidget.LABEL;
        this.title.caption = 'Capability X-ray Panel';
        this.title.iconClass = 'codicon codicon-list-tree';
        this.title.closable = false;
        this.addClass('capability-tree-widget');
    }

    /** Replace the item list (called after a scan). */
    setItems(items: CapabilityItem[]): void {
        this.items = items;
        this.update();
    }

    protected render(): React.ReactNode {
        const filtered = this.applyFilter(this.items);
        return (
            <div className='capability-tree-root'>
                <div className='capability-tree-search'>
                    <input
                        type='text'
                        placeholder='Search…'
                        value={this.filter}
                        onChange={e => this.setFilter(e.target.value)}
                        className='capability-search-input'
                    />
                </div>
                <div className='capability-tree-body'>
                    {this.renderLayer('global', filtered)}
                    {this.renderLayer('project', filtered)}
                </div>
            </div>
        );
    }

    private renderLayer(
        source: 'global' | 'project',
        items: CapabilityItem[],
    ): React.ReactNode {
        const label = source === 'global' ? 'GLOBAL (~/.claude)' : 'PROJECT';
        const skills = items.filter(i => i.source === source && i.type === 'skill');
        const rules = items.filter(i => i.source === source && i.type === 'rule');

        return (
            <div key={source} className='capability-layer'>
                <div className='capability-layer-header'>
                    {label}
                </div>
                {this.renderGroup(`${source}-skills`, 'Skills', skills)}
                {this.renderGroup(`${source}-rules`, 'Rules', rules)}
            </div>
        );
    }

    private renderGroup(
        groupId: string,
        label: string,
        items: CapabilityItem[],
    ): React.ReactNode {
        const expanded = this.expandedGroups.has(groupId);
        return (
            <div key={groupId} className='capability-group'>
                <div
                    className='capability-group-header'
                    onClick={() => this.toggleGroup(groupId)}
                >
                    <span className={`capability-expand-icon codicon ${expanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`} />
                    <span className='capability-group-label'>{label}</span>
                    <span className='capability-group-count'>({items.length})</span>
                </div>
                {expanded && (
                    <ul className='capability-item-list'>
                        {items.length === 0 && (
                            <li className='capability-item-empty'>—</li>
                        )}
                        {items.map(item => this.renderItem(item))}
                    </ul>
                )}
            </div>
        );
    }

    private renderItem(item: CapabilityItem): React.ReactNode {
        const selected = this.selectedItem === item;
        return (
            <li
                key={item.path}
                className={`capability-item${selected ? ' capability-item-selected' : ''}`}
                title={item.description || item.path}
                onClick={() => this.selectItem(item)}
            >
                <span className='capability-item-name'>{item.name}</span>
                {item.trigger && (
                    <span className='capability-item-trigger'>{item.trigger}</span>
                )}
            </li>
        );
    }

    private applyFilter(items: CapabilityItem[]): CapabilityItem[] {
        const q = this.filter.trim().toLowerCase();
        if (!q) return items;
        return items.filter(
            i =>
                i.name.toLowerCase().includes(q) ||
                i.description.toLowerCase().includes(q),
        );
    }

    private setFilter(value: string): void {
        this.filter = value;
        this.update();
    }

    private toggleGroup(groupId: string): void {
        if (this.expandedGroups.has(groupId)) {
            this.expandedGroups.delete(groupId);
        } else {
            this.expandedGroups.add(groupId);
        }
        this.update();
    }

    private selectItem(item: CapabilityItem): void {
        this.selectedItem = item;
        this.onDidSelectItemEmitter.fire(item);
        this.update();
    }
}
