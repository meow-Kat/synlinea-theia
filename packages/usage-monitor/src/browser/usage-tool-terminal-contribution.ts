/**
 * UT6 + UT7 – UsageToolTerminalContribution
 *
 * Registers the command `usageMonitor.openToolTerminal` and a default keybinding
 * (Cmd+Alt+U / Ctrl+Alt+U).  When invoked:
 *
 *   1. Shows a QuickPick with "Claude" and "Codex".
 *   2. Opens a new terminal and runs the selected CLI (`claude` or `codex`).
 *      Shell-ready timing (R6): `sendText` is called only after the terminal's
 *      `onDidOpen` event fires, so the command is not dropped into an uninitialised
 *      PTY.
 *   3. Fetches the selected tool's quota via `UsageService.getUsage()` and writes
 *      two numbers (current-session % + weekly %) to a StatusBar item.
 *      Display: `Claude  session 28%  weekly 81%⚠`
 *      If a window is missing or `available:false` → shows `N/A`.
 *   4. Starts a 60-second auto-refresh timer that updates the same StatusBar item.
 *      The previous timer is cleared whenever a new pick is made.
 */

import { injectable, inject } from 'inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser/keybinding';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { QuickInputService } from '@theia/core/lib/common/quick-pick-service';
import { StatusBar, StatusBarAlignment } from '@theia/core/lib/browser/status-bar/status-bar-types';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { TerminalWidget } from '@theia/terminal/lib/browser/base/terminal-widget';
import { UsageService, ToolUsage, ToolName } from '../common/usage-protocol';
import { interfaces } from 'inversify';

// ── Command descriptor ────────────────────────────────────────────────────────

export const USAGE_OPEN_TOOL_TERMINAL_COMMAND = {
    id: 'usageMonitor.openToolTerminal',
    label: 'Usage Monitor: Open Tool Terminal',
};

// ── Status-bar item id ────────────────────────────────────────────────────────

const STATUS_BAR_ITEM_ID = 'usage-monitor-quota';
const AUTO_REFRESH_MS = 60_000;

// ── Contribution class ────────────────────────────────────────────────────────

@injectable()
export class UsageToolTerminalContribution
    implements CommandContribution, KeybindingContribution, FrontendApplicationContribution {

    @inject(QuickInputService)
    protected readonly quickInputService: QuickInputService;

    @inject(TerminalService)
    protected readonly terminalService: TerminalService;

    @inject(UsageService)
    protected readonly usageService: UsageService;

    @inject(StatusBar)
    protected readonly statusBar: StatusBar;

    /** Currently selected tool name (persisted across refreshes). */
    private currentTool: ToolName | undefined;

    /** Auto-refresh timer handle; replaced on each new pick, cleared on dispose. */
    private refreshTimer: ReturnType<typeof setInterval> | undefined;

    // ── CommandContribution ───────────────────────────────────────────────────

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(USAGE_OPEN_TOOL_TERMINAL_COMMAND, {
            execute: () => void this.execute(),
        });
    }

    // ── KeybindingContribution ────────────────────────────────────────────────

    registerKeybindings(keybindings: KeybindingRegistry): void {
        keybindings.registerKeybinding({
            command: USAGE_OPEN_TOOL_TERMINAL_COMMAND.id,
            // ctrlcmd resolves to Cmd on macOS, Ctrl on Linux/Windows.
            keybinding: 'ctrlcmd+alt+u',
        });
    }

    // ── FrontendApplicationContribution ───────────────────────────────────────

    /**
     * On startup, show a persistent, clickable status-bar launcher so there is a
     * visible affordance (not only the keybinding). Clicking it runs the same
     * command as Cmd/Ctrl+Alt+U. Once a tool is picked, updateStatusBar() replaces
     * this item (same id) with the live quota — still clickable to re-pick/refresh.
     */
    onStart(): void {
        void this.statusBar.setElement(STATUS_BAR_ITEM_ID, {
            text: '$(pulse) Usage',
            alignment: StatusBarAlignment.RIGHT,
            priority: 100,
            tooltip: 'Open Claude/Codex terminal + usage (Cmd/Ctrl+Alt+U)',
            command: USAGE_OPEN_TOOL_TERMINAL_COMMAND.id,
        });
    }

    // ── Main action ───────────────────────────────────────────────────────────

    private async execute(): Promise<void> {
        // 1. Quick-pick Claude / Codex.
        const picked = await this.quickInputService.showQuickPick(
            [
                { label: 'Claude' },
                { label: 'Codex' },
            ],
            { placeholder: 'Select tool to open' },
        );
        if (!picked) {
            return; // user dismissed
        }

        const tool: ToolName = picked.label === 'Claude' ? 'claude' : 'codex';
        this.currentTool = tool;

        // 2. Open a new terminal (bottom panel) and send the CLI command once
        //    the shell is ready (R6: wait for onDidOpen before sendText).
        await this.openTerminalForTool(tool);

        // 3. Show quota in status bar + start 60 s auto-refresh.
        await this.updateStatusBar(tool);
        this.restartRefreshTimer(tool);
    }

    // ── Terminal opening ──────────────────────────────────────────────────────

    private async openTerminalForTool(tool: ToolName): Promise<void> {
        const cli = tool === 'claude' ? 'claude' : 'codex';
        let terminal: TerminalWidget;
        try {
            terminal = await this.terminalService.newTerminal({
                title: tool === 'claude' ? 'Claude' : 'Codex',
                destroyTermOnClose: true,
            });
            // CRITICAL (Theia gotcha): newTerminal() only builds the widget — it
            // does NOT spawn the backend PTY. Without `await terminal.start()` the
            // terminal stays blank (no shell, no output) and sendText is dropped.
            // Must start() before open()/sendText.
            await terminal.start();
        } catch {
            // Terminal creation failure is non-fatal — quota still shows.
            return;
        }

        // open() makes the terminal visible; widgetOptions places it in the
        // bottom panel alongside existing terminals.
        this.terminalService.open(terminal, {
            widgetOptions: { area: 'bottom' },
        });

        // R6 – wait for the shell to actually be ready before sending text.
        // onDidOpen only means the PTY connected; the shell may not yet accept
        // input (command gets dropped → blank terminal). The reliable signal is
        // the first `onData` (shell has printed its prompt). We resolve on that
        // (plus a small debounce), with onDidOpen + a hard timeout as fallbacks.
        await this.waitForShellReady(terminal);
        terminal.sendText(`${cli}\n`);
    }

    /**
     * Resolves once the terminal's shell looks ready to accept input:
     *   - first `onData` (shell printed output/prompt) → +150ms debounce  [primary]
     *   - `onDidOpen` (PTY connected) → +800ms                            [fallback]
     *   - 6s hard timeout                                                 [safety]
     * Whichever fires first wins.
     */
    private waitForShellReady(terminal: TerminalWidget): Promise<void> {
        return new Promise<void>(resolve => {
            let done = false;
            const subs: { dispose(): void }[] = [];
            const finish = (delayMs: number): void => {
                if (done) {
                    return;
                }
                done = true;
                subs.forEach(s => s.dispose());
                if (delayMs > 0) {
                    setTimeout(resolve, delayMs);
                } else {
                    resolve();
                }
            };
            subs.push(terminal.onData(() => finish(150)));      // shell prompt appeared
            subs.push(terminal.onDidOpen(() => finish(800)));   // PTY connected, no data yet
            const t = setTimeout(() => finish(0), 6_000);       // never block forever
            subs.push({ dispose: () => clearTimeout(t) });
        });
    }

    // ── Quota display (status bar) ────────────────────────────────────────────

    /**
     * Fetch usage data and write the selected tool's two numbers to the
     * status-bar item.
     *
     * Format (R5):  `Claude  session 28%  weekly 81%⚠`
     *               `Codex   session N/A  weekly N/A`
     */
    private async updateStatusBar(tool: ToolName): Promise<void> {
        let toolUsage: ToolUsage | undefined;
        try {
            const all = await this.usageService.getUsage();
            toolUsage = all.find(tu => tu.tool === tool);
        } catch {
            // Service error — show N/A for both.
        }

        const label = tool === 'claude' ? 'Claude' : 'Codex';
        const sessionText = this.formatWindow(toolUsage, 'session');
        const weeklyText  = this.formatWindow(toolUsage, 'weekly');

        // Append a ⚠ warning indicator if any window is at warning/critical.
        const hasWarning = toolUsage?.available && toolUsage.windows.some(
            w => w.severity === 'warning' || w.severity === 'critical',
        );
        const warning = hasWarning ? '⚠' : '';

        const text = `${label}  session ${sessionText}  weekly ${weeklyText}${warning}`;

        await this.statusBar.setElement(STATUS_BAR_ITEM_ID, {
            text,
            alignment: StatusBarAlignment.RIGHT,
            priority: 100,
            tooltip: `${label} quota — click to refresh`,
            command: USAGE_OPEN_TOOL_TERMINAL_COMMAND.id,
        });
    }

    /**
     * Format a single window's percent for status bar display.
     *
     * Window mapping:
     *   Claude — session = five_hour window (kind='session')
     *             weekly  = seven_day window (kind='weekly')
     *   Codex  — session = secondary window  (kind='session')
     *             weekly  = primary window    (kind='weekly')
     *
     * Returns `N/A` when the tool is unavailable or the window is absent.
     */
    private formatWindow(toolUsage: ToolUsage | undefined, kind: 'session' | 'weekly'): string {
        if (!toolUsage || !toolUsage.available) {
            return 'N/A';
        }
        const win = toolUsage.windows.find(w => w.kind === kind);
        if (!win) {
            return 'N/A';
        }
        const pct = Math.max(0, Math.min(100, win.percent));
        return `${pct.toFixed(0)}%`;
    }

    // ── Auto-refresh timer ────────────────────────────────────────────────────

    private restartRefreshTimer(tool: ToolName): void {
        this.clearRefreshTimer();
        this.refreshTimer = setInterval(() => {
            void this.updateStatusBar(tool);
        }, AUTO_REFRESH_MS);
    }

    private clearRefreshTimer(): void {
        if (this.refreshTimer !== undefined) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = undefined;
        }
    }

    /** Called by DI container teardown / on explicit dispose. */
    dispose(): void {
        this.clearRefreshTimer();
        void this.statusBar.removeElement(STATUS_BAR_ITEM_ID);
    }
}

// ── DI wiring helper ──────────────────────────────────────────────────────────

/** Bind UsageToolTerminalContribution and register all its contribution roles. */
export function bindUsageToolTerminalContribution(bind: interfaces.Bind): void {
    bind(UsageToolTerminalContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(UsageToolTerminalContribution);
    bind(KeybindingContribution).toService(UsageToolTerminalContribution);
    bind(FrontendApplicationContribution).toService(UsageToolTerminalContribution);
}
