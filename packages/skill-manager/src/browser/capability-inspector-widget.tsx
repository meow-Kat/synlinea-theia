import * as React from 'react';
import { injectable, inject, postConstruct } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MarkdownRenderer } from '@theia/core/lib/browser/markdown-rendering/markdown-renderer';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import URI from '@theia/core/lib/common/uri';
import { CapabilityItem } from '../common/capability-item';

/**
 * VT7 – Right-side Inspector widget.
 * Shows header, rendered markdown body, and details (tools/model/path/relationships).
 * Default view: Rendered. Toggle to Raw available.
 */
@injectable()
export class CapabilityInspectorWidget extends ReactWidget {

    static readonly ID = 'capability-inspector';
    static readonly LABEL = 'Inspector';

    @inject(MarkdownRenderer)
    protected readonly markdownRenderer: MarkdownRenderer;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    private item: CapabilityItem | undefined;
    private viewMode: 'rendered' | 'raw' = 'rendered';

    @postConstruct()
    protected init(): void {
        this.id = CapabilityInspectorWidget.ID;
        this.title.label = CapabilityInspectorWidget.LABEL;
        this.title.caption = 'Capability Inspector';
        this.title.closable = true;
        this.addClass('capability-inspector-widget');
        this.node.style.overflowY = 'auto';
    }

    /** Called by the tree widget when the user selects an item. */
    setItem(item: CapabilityItem | undefined): void {
        this.item = item;
        this.viewMode = 'rendered'; // reset to rendered on each selection
        this.update();
    }

    protected render(): React.ReactNode {
        if (!this.item) {
            return (
                <div className='capability-inspector-empty'>
                    <p>Select a skill or rule on the left to inspect it.</p>
                </div>
            );
        }
        return this.renderItem(this.item);
    }

    private renderItem(item: CapabilityItem): React.ReactNode {
        return (
            <div className='capability-inspector-content'>
                {this.renderHeader(item)}
                <hr className='capability-inspector-divider' />
                {this.renderReadme(item)}
                <hr className='capability-inspector-divider' />
                {this.renderDetails(item)}
                <div className='capability-inspector-actions'>
                    <button
                        className='theia-button secondary'
                        onClick={() => this.openInEditor(item)}
                        title={`Open ${item.path} in editor`}
                    >
                        Open in editor
                    </button>
                </div>
            </div>
        );
    }

    private renderHeader(item: CapabilityItem): React.ReactNode {
        return (
            <div className='capability-inspector-header'>
                <span className='capability-inspector-icon'>
                    {item.type === 'skill' ? '⬡' : '📋'}
                </span>
                <span className='capability-inspector-name'>{item.name}</span>
                <div className='capability-inspector-badges'>
                    <span className={`capability-badge capability-badge-type-${item.type}`}>
                        {item.type === 'skill' ? 'Skill' : 'Rule'}
                    </span>
                    <span className={`capability-badge capability-badge-source-${item.source}`}>
                        {item.source === 'global' ? 'Global' : 'Project'}
                    </span>
                    {item.trigger && (
                        <span className='capability-badge capability-badge-trigger'>
                            {item.trigger}
                        </span>
                    )}
                </div>
                {item.description && (
                    <p className='capability-inspector-desc'>{item.description}</p>
                )}
            </div>
        );
    }

    private renderReadme(item: CapabilityItem): React.ReactNode {
        return (
            <div className='capability-inspector-readme'>
                <div className='capability-inspector-readme-toolbar'>
                    <span className='capability-inspector-section-title'>Readme</span>
                    <span className='capability-inspector-toggle'>
                        <button
                            className={`capability-toggle-btn${this.viewMode === 'rendered' ? ' active' : ''}`}
                            onClick={() => this.setViewMode('rendered')}
                        >
                            Rendered
                        </button>
                        <button
                            className={`capability-toggle-btn${this.viewMode === 'raw' ? ' active' : ''}`}
                            onClick={() => this.setViewMode('raw')}
                        >
                            Raw
                        </button>
                    </span>
                </div>
                {this.viewMode === 'rendered'
                    ? this.renderMarkdownBody(item.body)
                    : (
                        <pre className='capability-inspector-raw'>
                            <code>{item.body}</code>
                        </pre>
                    )
                }
            </div>
        );
    }

    /**
     * VT2 outcome: use Theia's built-in MarkdownRenderer (markdown-it based).
     * We render synchronously by calling renderer.render() and injecting the resulting
     * element via a ref callback. This avoids dangerouslySetInnerHTML and keeps
     * Theia's rendering pipeline (code highlighting, link handling) intact.
     */
    private renderMarkdownBody(body: string): React.ReactNode {
        return (
            <MarkdownBodyView
                body={body}
                markdownRenderer={this.markdownRenderer}
            />
        );
    }

    private renderDetails(item: CapabilityItem): React.ReactNode {
        return (
            <div className='capability-inspector-details'>
                <span className='capability-inspector-section-title'>Details</span>
                <table className='capability-inspector-meta'>
                    <tbody>
                        {item.tools && item.tools.length > 0 && (
                            <tr>
                                <td className='meta-key'>Tools</td>
                                <td className='meta-value'>{item.tools.join(', ')}</td>
                            </tr>
                        )}
                        {item.model && (
                            <tr>
                                <td className='meta-key'>Model</td>
                                <td className='meta-value'>{item.model}</td>
                            </tr>
                        )}
                        <tr>
                            <td className='meta-key'>Path</td>
                            <td className='meta-value meta-path' title={item.path}>
                                {item.path}
                            </td>
                        </tr>
                    </tbody>
                </table>
                {this.renderRelationships(item)}
            </div>
        );
    }

    private renderRelationships(item: CapabilityItem): React.ReactNode {
        const hasRefs = item.refsOut.length > 0 || item.refsIn.length > 0;
        if (!hasRefs) return null;

        return (
            <div className='capability-inspector-refs'>
                {item.refsOut.length > 0 && (
                    <div className='refs-section'>
                        <span className='refs-label'>References →</span>
                        <ul className='refs-list'>
                            {item.refsOut.map((ref, i) => (
                                <li key={i} className={ref.included ? 'ref-included' : 'ref-external'}>
                                    {ref.included ? `/${ref.name}` : ref.name}
                                    {!ref.included && (
                                        <span className='ref-note'>
                                            {ref.excludedReason === 'subagent/not-included'
                                                ? ' (subagent, not included this cut)'
                                                : ' (not included)'}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {item.refsIn.length > 0 && (
                    <div className='refs-section'>
                        <span className='refs-label'>Referenced by ←</span>
                        <ul className='refs-list'>
                            {item.refsIn.map((ref, i) => (
                                <li key={i} className='ref-included'>{ref.name}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    }

    private setViewMode(mode: 'rendered' | 'raw'): void {
        this.viewMode = mode;
        this.update();
    }

    private async openInEditor(item: CapabilityItem): Promise<void> {
        const uri = URI.fromFilePath(item.path);
        await this.editorManager.open(uri);
    }
}

// ── Helper component that injects the Theia MarkdownRenderer output into the DOM ──

interface MarkdownBodyViewProps {
    body: string;
    markdownRenderer: MarkdownRenderer;
}

/**
 * A thin React component that uses a ref to inject the HTMLElement produced
 * by Theia's MarkdownRenderer (markdown-it based) into the DOM.
 * This is the VT2 verified pipeline.
 */
class MarkdownBodyView extends React.Component<MarkdownBodyViewProps> {
    private containerRef = React.createRef<HTMLDivElement>();
    private currentDispose: (() => void) | undefined;

    override componentDidMount(): void {
        this.renderMarkdown();
    }

    override componentDidUpdate(prev: MarkdownBodyViewProps): void {
        if (prev.body !== this.props.body) {
            this.renderMarkdown();
        }
    }

    override componentWillUnmount(): void {
        this.currentDispose?.();
    }

    private renderMarkdown(): void {
        const container = this.containerRef.current;
        if (!container) return;

        // Dispose previous render result
        this.currentDispose?.();
        container.innerHTML = '';

        try {
            const result = this.props.markdownRenderer.render(
                { value: this.props.body, isTrusted: false, supportHtml: false },
            );
            container.appendChild(result.element);
            this.currentDispose = () => result.dispose();
        } catch {
            // Fallback: plain text
            container.textContent = this.props.body;
            this.currentDispose = undefined;
        }
    }

    override render(): React.ReactNode {
        return (
            <div
                ref={this.containerRef}
                className='capability-inspector-rendered-body theia-md-content'
            />
        );
    }
}
