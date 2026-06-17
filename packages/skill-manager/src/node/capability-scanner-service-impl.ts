import * as fs from 'fs';
import * as nodePath from 'path';
import * as os from 'os';
import { injectable } from 'inversify';
import { glob } from 'glob';
import matter = require('gray-matter');
import { CapabilityItem, CapabilityRef } from '../common/capability-item';
import { CapabilityScannerService } from '../common/capability-scanner-protocol';

/** Known subagent names that may appear in skill/rule bodies (not scanned this cut). */
const KNOWN_SUBAGENT_NAMES = new Set([
    'coder', 'tester', 'verifier', 'entropy-scan', 'pr-finalize',
    'lang-consistency-scan', 'lang-consistency-fix',
]);

@injectable()
export class CapabilityScannerServiceImpl implements CapabilityScannerService {

    async scan(workspaceRoot: string | undefined): Promise<CapabilityItem[]> {
        const globalBase = nodePath.join(os.homedir(), '.claude');
        const items: CapabilityItem[] = [];

        // ── 1. Collect raw items ──────────────────────────────────────────────

        // Global skills: ~/.claude/skills/*/SKILL.md
        const globalSkillPaths = await this.globSafe(
            nodePath.join(globalBase, 'skills', '*', 'SKILL.md'),
        );
        for (const p of globalSkillPaths) {
            const item = this.parseSkillFile(p, 'global');
            if (item) items.push(item);
        }

        // Project skills: <workspace>/.claude/skills/*/SKILL.md
        if (workspaceRoot) {
            const projectSkillPaths = await this.globSafe(
                nodePath.join(workspaceRoot, '.claude', 'skills', '*', 'SKILL.md'),
            );
            for (const p of projectSkillPaths) {
                const item = this.parseSkillFile(p, 'project');
                if (item) items.push(item);
            }
        }

        // Global rule: ~/.claude/CLAUDE.md
        const globalRulePath = nodePath.join(globalBase, 'CLAUDE.md');
        const globalRule = this.parseRuleFile(globalRulePath, 'global');
        if (globalRule) items.push(globalRule);

        // Project rule: <workspace>/CLAUDE.md
        if (workspaceRoot) {
            const projectRulePath = nodePath.join(workspaceRoot, 'CLAUDE.md');
            const projectRule = this.parseRuleFile(projectRulePath, 'project');
            if (projectRule) items.push(projectRule);
        }

        // ── 2. Build relationship index ───────────────────────────────────────
        this.buildRelationships(items);

        return items;
    }

    // ── Parsing ───────────────────────────────────────────────────────────────

    private parseSkillFile(filePath: string, source: 'global' | 'project'): CapabilityItem | null {
        const raw = this.readFile(filePath);
        if (raw === null) return null;

        let frontmatter: Record<string, unknown> = {};
        let body = raw;
        try {
            const parsed = matter(raw);
            frontmatter = (parsed.data as Record<string, unknown>) || {};
            // gray-matter strips the YAML block; body is the content after
            body = parsed.content;
        } catch {
            // bad frontmatter — treat whole file as body
        }

        const name =
            (typeof frontmatter['name'] === 'string' && frontmatter['name']) ||
            this.skillNameFromPath(filePath);

        const description =
            (typeof frontmatter['description'] === 'string' && frontmatter['description']) ||
            this.firstMeaningfulLine(body);

        const tools: string[] | undefined = Array.isArray(frontmatter['tools'])
            ? (frontmatter['tools'] as unknown[]).map(String)
            : undefined;

        const model =
            typeof frontmatter['model'] === 'string' ? frontmatter['model'] : undefined;

        return {
            type: 'skill',
            name,
            description,
            path: filePath,
            source,
            trigger: `/${name}`,
            tools,
            model,
            body: raw, // keep full raw for rendering
            refsOut: [],
            refsIn: [],
        };
    }

    private parseRuleFile(filePath: string, source: 'global' | 'project'): CapabilityItem | null {
        const raw = this.readFile(filePath);
        if (raw === null) return null;

        // Rules (CLAUDE.md) typically have no frontmatter; use filename + layer
        let body = raw;
        try {
            const parsed = matter(raw);
            // If there IS frontmatter, use its body; otherwise full raw
            if (Object.keys(parsed.data).length > 0) {
                body = parsed.content;
            }
        } catch {
            // ignore
        }

        const baseName = nodePath.basename(filePath, '.md');
        const name = source === 'global'
            ? `${baseName} (global)`
            : `${baseName} (project)`;

        const description = this.firstMeaningfulLine(body);

        return {
            type: 'rule',
            name,
            description,
            path: filePath,
            source,
            body: raw,
            refsOut: [],
            refsIn: [],
        };
    }

    // ── Relationship index (Level B) ──────────────────────────────────────────

    private buildRelationships(items: CapabilityItem[]): void {
        // Build lookup maps
        const byName = new Map<string, CapabilityItem>();
        for (const item of items) {
            byName.set(item.name.toLowerCase(), item);
        }

        // Skill names only (for slash-trigger matching and plain-name matching)
        const skillNames = items
            .filter(i => i.type === 'skill')
            .map(i => i.name);

        for (const item of items) {
            // Exclude self-references (a capability mentioning its own name in its body
            // is not a relationship). Inbound is already self-guarded below (target !== item).
            item.refsOut = this.extractRefs(item.body, skillNames, byName)
                .filter(ref => ref.name.toLowerCase() !== item.name.toLowerCase());
        }

        // Build inbound (refsIn) = reverse of refsOut
        for (const item of items) {
            for (const ref of item.refsOut) {
                if (!ref.included) continue;
                // Find the target item
                const target = this.resolveRefToItem(ref.name, byName);
                if (target && target !== item) {
                    // Avoid duplicate inbound entries
                    const alreadyIn = target.refsIn.some(r => r.name === ref.name);
                    if (!alreadyIn) {
                        target.refsIn.push({
                            name: item.name,
                            included: true,
                        });
                    }
                }
            }
        }
    }

    private extractRefs(
        body: string,
        skillNames: string[],
        byName: Map<string, CapabilityItem>,
    ): CapabilityRef[] {
        const refs: CapabilityRef[] = [];
        const seen = new Set<string>();

        const addRef = (rawName: string) => {
            const key = rawName.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);

            const inScan = byName.has(key);
            if (inScan) {
                refs.push({ name: rawName, included: true });
            } else if (KNOWN_SUBAGENT_NAMES.has(rawName.toLowerCase())) {
                refs.push({
                    name: rawName,
                    included: false,
                    excludedReason: 'subagent/not-included',
                });
            }
            // otherwise ignore (not a known capability at all)
        };

        // Pattern 1: [[link]] style
        const wikiLinkRe = /\[\[([^\]]+)\]\]/g;
        let m: RegExpExecArray | null;
        while ((m = wikiLinkRe.exec(body)) !== null) {
            addRef(m[1].trim());
        }

        // Pattern 2: slash triggers — /skill-name (word boundary or whitespace follows)
        // Match /<word-chars> that are NOT a URL (skip http://)
        const slashTriggerRe = /(?<![:\w])\/([a-zA-Z][\w-]*)/g;
        while ((m = slashTriggerRe.exec(body)) !== null) {
            const candidate = m[1];
            // Check if this slash-name matches a known skill name
            if (skillNames.some(n => n.toLowerCase() === candidate.toLowerCase())) {
                addRef(candidate);
            }
        }

        // Pattern 3: plain skill name literals (word-boundary, case-insensitive)
        // Only match if the skill name is >= 4 chars to reduce false positives
        for (const sn of skillNames) {
            if (sn.length < 4) continue;
            const esc = sn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`\\b${esc}\\b`, 'i');
            if (re.test(body)) {
                addRef(sn);
            }
        }

        // Also check for known subagent names not in the scan
        for (const agentName of KNOWN_SUBAGENT_NAMES) {
            if (agentName.length < 4) continue;
            const esc = agentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`\\b${esc}\\b`, 'i');
            if (re.test(body)) {
                addRef(agentName);
            }
        }

        return refs;
    }

    private resolveRefToItem(
        refName: string,
        byName: Map<string, CapabilityItem>,
    ): CapabilityItem | undefined {
        return byName.get(refName.toLowerCase());
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    private async globSafe(pattern: string): Promise<string[]> {
        try {
            // glob v10 uses forward slashes on all platforms; convert pattern separators
            const normalized = pattern.replace(/\\/g, '/');
            return await glob(normalized, { absolute: true });
        } catch {
            return [];
        }
    }

    private readFile(filePath: string): string | null {
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch {
            return null;
        }
    }

    private skillNameFromPath(filePath: string): string {
        // ~/.claude/skills/<name>/SKILL.md  →  <name>
        return nodePath.basename(nodePath.dirname(filePath));
    }

    private firstMeaningfulLine(text: string): string {
        const lines = text.split('\n');
        for (const line of lines) {
            const trimmed = line.replace(/^#+\s*/, '').trim();
            if (trimmed.length > 0) {
                return trimmed.length > 120 ? trimmed.slice(0, 117) + '…' : trimmed;
            }
        }
        return '';
    }
}
