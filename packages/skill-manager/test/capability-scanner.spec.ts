/**
 * VT9 — Unit tests for the v2 Capability x-ray scanner.
 *
 * Covers (per docs/plans/v2-capability-xray-panel.md §測試計畫):
 *   ① frontmatter parser fault tolerance:
 *      - valid frontmatter (name/description/tools/model)
 *      - missing description → falls back to first meaningful body line
 *      - bad / malformed frontmatter → treats whole file as body, derives name from path
 *      - a rule file (CLAUDE.md) with NO frontmatter → name = filename + source layer,
 *        description = first meaningful body line
 *   ② relationship indexer (Level B):
 *      - forward refsOut: `/slash` triggers, plain skill-name literals, `[[wiki links]]`
 *      - inbound refsIn: reverse map, no missing / no duplicates
 *      - references to not-included subagent names flagged included=false +
 *        excludedReason 'subagent/not-included'
 *
 * Isolation strategy:
 *   The production `scan()` reads global skills/rules from `os.homedir()/.claude`
 *   and project skills/rules from `<workspaceRoot>`. To keep the test hermetic and
 *   never touch the real `~/.claude`, we:
 *     - build a throwaway temp tree under os.tmpdir() with both a fake global
 *       (`<tmp>/home/.claude`) and a fake project (`<tmp>/ws`),
 *     - stub `os.homedir()` to return `<tmp>/home` for the duration of the suite.
 *   Everything is generated on disk at runtime (no committed .md fixtures), so the
 *   suite is self-contained and deterministic.
 *
 * NOTE (testability follow-up for the coder, not done here): the pure helpers
 *   (frontmatter parse, relationship index) are `private` on
 *   CapabilityScannerServiceImpl, and `scan()` hardwires the global base to
 *   `os.homedir()/.claude`. We therefore drive everything through the single
 *   public method `scan()` and stub `os.homedir`. Exporting the pure
 *   parse/index helpers (or injecting the global base) would let these be tested
 *   directly without the homedir stub.
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as nodePath from 'path';
import { CapabilityScannerServiceImpl } from '../src/node/capability-scanner-service-impl';
import { CapabilityItem } from '../src/common/capability-item';

describe('CapabilityScannerServiceImpl', () => {

    let tmpRoot: string;
    let fakeHome: string;
    let workspaceRoot: string;
    let originalHome: string | undefined;

    /** Write a file, creating parent dirs as needed. */
    function writeFile(filePath: string, content: string): void {
        fs.mkdirSync(nodePath.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content, 'utf8');
    }

    /** Write a global skill: <fakeHome>/.claude/skills/<name>/SKILL.md */
    function writeGlobalSkill(name: string, content: string): void {
        writeFile(nodePath.join(fakeHome, '.claude', 'skills', name, 'SKILL.md'), content);
    }

    before(() => {
        tmpRoot = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'synlinea-vt9-'));
        fakeHome = nodePath.join(tmpRoot, 'home');
        workspaceRoot = nodePath.join(tmpRoot, 'ws');
        fs.mkdirSync(fakeHome, { recursive: true });
        fs.mkdirSync(workspaceRoot, { recursive: true });

        // Redirect os.homedir() into our temp tree via $HOME (POSIX os.homedir()
        // reads $HOME) instead of the real ~/.claude. Restored in after().
        // NB: reassigning os.homedir fails under ESM (getter-only namespace), so we
        // override the env var the function reads.
        originalHome = process.env.HOME;
        process.env.HOME = fakeHome;

        // ── Global skills ─────────────────────────────────────────────────────
        // alpha-skill: valid frontmatter + tools + model; references /beta-skill
        // (slash trigger) and the `coder` subagent (not included this cut).
        writeGlobalSkill('alpha-skill', [
            '---',
            'name: alpha-skill',
            'description: Alpha orchestrates the pipeline.',
            'tools:',
            '  - Read',
            '  - Edit',
            'model: claude-opus-4-8',
            '---',
            '',
            '# Alpha Skill',
            '',
            'Alpha runs first. When it finishes it hands off to /beta-skill,',
            'and may delegate mutating work to the coder subagent.',
            '',
        ].join('\n'));

        // beta-skill: valid frontmatter; references [[alpha-skill]] via wiki link.
        writeGlobalSkill('beta-skill', [
            '---',
            'name: beta-skill',
            'description: Beta finishes what alpha started.',
            '---',
            '',
            '# Beta Skill',
            '',
            'Beta continues the work begun by [[alpha-skill]].',
            '',
        ].join('\n'));

        // no-desc: frontmatter has a name but NO description → fall back to the
        // first meaningful body line.
        writeGlobalSkill('no-desc', [
            '---',
            'name: no-desc',
            '---',
            '',
            '# Heading is stripped of hashes',
            '',
            'This skill has no description field.',
            '',
        ].join('\n'));

        // bad-frontmatter: malformed YAML between the fences. gray-matter may
        // throw or yield empty data; either way the parser must not crash and the
        // name must fall back to the directory name (skillNameFromPath).
        writeGlobalSkill('bad-frontmatter', [
            '---',
            'name: "unterminated',
            ': : : not: valid: yaml',
            '  - [unbalanced',
            '---',
            '',
            'Body after a broken frontmatter block.',
            '',
        ].join('\n'));

        // no-frontmatter: SKILL.md with no YAML fence at all → name from path,
        // description from first meaningful body line.
        writeGlobalSkill('no-frontmatter', [
            '# Plain Skill',
            '',
            'No frontmatter here at all.',
            '',
        ].join('\n'));

        // ── Global rule (~/.claude/CLAUDE.md) ─────────────────────────────────
        // No frontmatter → name = "CLAUDE (global)", description = first line.
        // References alpha-skill (plain name) and the `tester` subagent.
        writeFile(nodePath.join(fakeHome, '.claude', 'CLAUDE.md'), [
            '# Global rules',
            '',
            'Always start with alpha-skill before anything else.',
            'For checks, hand off to the tester subagent.',
            '',
        ].join('\n'));

        // ── Project rule (<ws>/CLAUDE.md) ─────────────────────────────────────
        // No frontmatter → name = "CLAUDE (project)".
        writeFile(nodePath.join(workspaceRoot, 'CLAUDE.md'), [
            '# Project rules',
            '',
            'This project leans on alpha-skill and beta-skill.',
            '',
        ].join('\n'));
    });

    after(() => {
        if (originalHome === undefined) {
            delete process.env.HOME;
        } else {
            process.env.HOME = originalHome;
        }
        if (tmpRoot) {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        }
    });

    // Shared scan result; populated once.
    let items: CapabilityItem[];

    function byName(name: string): CapabilityItem {
        const found = items.find(i => i.name === name);
        expect(found, `expected an item named "${name}" in scan output`).to.not.equal(undefined);
        return found as CapabilityItem;
    }

    before(async () => {
        const service = new CapabilityScannerServiceImpl();
        items = await service.scan(workspaceRoot);
    });

    describe('frontmatter parser (fault tolerance)', () => {

        it('parses valid frontmatter: name, description, tools, model, trigger', () => {
            const alpha = byName('alpha-skill');
            expect(alpha.type).to.equal('skill');
            expect(alpha.source).to.equal('global');
            expect(alpha.description).to.equal('Alpha orchestrates the pipeline.');
            expect(alpha.tools).to.deep.equal(['Read', 'Edit']);
            expect(alpha.model).to.equal('claude-opus-4-8');
            expect(alpha.trigger).to.equal('/alpha-skill');
            expect(alpha.path).to.match(/alpha-skill[\\/]SKILL\.md$/);
        });

        it('falls back to first meaningful body line when description is missing', () => {
            const noDesc = byName('no-desc');
            expect(noDesc.type).to.equal('skill');
            // Heading hashes are stripped by firstMeaningfulLine → first non-empty line.
            expect(noDesc.description).to.equal('Heading is stripped of hashes');
            // No description in frontmatter, no tools/model either.
            expect(noDesc.tools).to.equal(undefined);
            expect(noDesc.model).to.equal(undefined);
        });

        it('tolerates malformed frontmatter: no crash, name derived from path', () => {
            const bad = byName('bad-frontmatter');
            expect(bad.type).to.equal('skill');
            // name must come from the containing directory, not the broken YAML.
            expect(bad.name).to.equal('bad-frontmatter');
            expect(bad.trigger).to.equal('/bad-frontmatter');
            // a description string is still produced (never undefined/null).
            expect(bad.description).to.be.a('string');
        });

        it('handles a skill with no frontmatter: name from path, desc from first line', () => {
            const none = byName('no-frontmatter');
            expect(none.type).to.equal('skill');
            expect(none.name).to.equal('no-frontmatter');
            expect(none.description).to.equal('Plain Skill');
        });

        it('handles a rule (CLAUDE.md) with NO frontmatter: filename + source layer', () => {
            const globalRule = byName('CLAUDE (global)');
            expect(globalRule.type).to.equal('rule');
            expect(globalRule.source).to.equal('global');
            // No trigger / tools / model on a rule.
            expect(globalRule.trigger).to.equal(undefined);
            expect(globalRule.description).to.equal('Global rules');

            const projectRule = byName('CLAUDE (project)');
            expect(projectRule.type).to.equal('rule');
            expect(projectRule.source).to.equal('project');
            expect(projectRule.description).to.equal('Project rules');
        });
    });

    describe('relationship indexer (Level B)', () => {

        it('resolves forward refsOut from a /slash trigger', () => {
            const alpha = byName('alpha-skill');
            const beta = alpha.refsOut.find(r => r.name.toLowerCase() === 'beta-skill');
            expect(beta, 'alpha should reference beta-skill').to.not.equal(undefined);
            expect((beta as { included: boolean }).included).to.equal(true);
        });

        it('resolves forward refsOut from a [[wiki link]]', () => {
            const beta = byName('beta-skill');
            const alpha = beta.refsOut.find(r => r.name.toLowerCase() === 'alpha-skill');
            expect(alpha, 'beta should reference alpha-skill via [[link]]').to.not.equal(undefined);
            expect((alpha as { included: boolean }).included).to.equal(true);
        });

        it('resolves forward refsOut from a plain skill-name literal in a rule', () => {
            const globalRule = byName('CLAUDE (global)');
            const ref = globalRule.refsOut.find(r => r.name.toLowerCase() === 'alpha-skill');
            expect(ref, 'global CLAUDE.md should reference alpha-skill by name').to.not.equal(undefined);
            expect((ref as { included: boolean }).included).to.equal(true);
        });

        it('builds inbound refsIn as the reverse of refsOut (no missing)', () => {
            const beta = byName('beta-skill');
            // beta is referenced by alpha (/beta-skill).
            const fromAlpha = beta.refsIn.find(r => r.name === 'alpha-skill');
            expect(fromAlpha, 'beta.refsIn should include alpha-skill').to.not.equal(undefined);

            const alpha = byName('alpha-skill');
            // alpha is referenced by beta ([[alpha-skill]]), the global rule and the
            // project rule (plain-name literals).
            const inboundNames = alpha.refsIn.map(r => r.name).sort();
            expect(inboundNames).to.include('beta-skill');
            expect(inboundNames).to.include('CLAUDE (global)');
            expect(inboundNames).to.include('CLAUDE (project)');
        });

        it('has no duplicate entries in refsOut or refsIn', () => {
            for (const item of items) {
                const outNames = item.refsOut.map(r => r.name.toLowerCase());
                expect(new Set(outNames).size, `dup in refsOut of ${item.name}`).to.equal(outNames.length);

                const inNames = item.refsIn.map(r => r.name.toLowerCase());
                expect(new Set(inNames).size, `dup in refsIn of ${item.name}`).to.equal(inNames.length);
            }
        });

        it('does not index a skill as referencing itself', () => {
            for (const item of items) {
                const selfOut = item.refsOut.some(r => r.name.toLowerCase() === item.name.toLowerCase());
                expect(selfOut, `${item.name} should not refsOut to itself`).to.equal(false);
                const selfIn = item.refsIn.some(r => r.name.toLowerCase() === item.name.toLowerCase());
                expect(selfIn, `${item.name} should not refsIn from itself`).to.equal(false);
            }
        });

        it('flags references to not-included subagent names', () => {
            const alpha = byName('alpha-skill');
            const coder = alpha.refsOut.find(r => r.name.toLowerCase() === 'coder');
            expect(coder, 'alpha should reference the coder subagent').to.not.equal(undefined);
            expect((coder as { included: boolean }).included).to.equal(false);
            expect((coder as { excludedReason?: string }).excludedReason)
                .to.equal('subagent/not-included');

            const globalRule = byName('CLAUDE (global)');
            const tester = globalRule.refsOut.find(r => r.name.toLowerCase() === 'tester');
            expect(tester, 'global rule should reference the tester subagent').to.not.equal(undefined);
            expect((tester as { included: boolean }).included).to.equal(false);
            expect((tester as { excludedReason?: string }).excludedReason)
                .to.equal('subagent/not-included');
        });

        it('does not create inbound edges for not-included subagent refs', () => {
            // No scanned item is named "coder"/"tester", so nothing to assert a target
            // on — just verify the excluded refs never leaked into any item's refsIn.
            for (const item of items) {
                const leaked = item.refsIn.some(r =>
                    r.name.toLowerCase() === 'coder' || r.name.toLowerCase() === 'tester');
                expect(leaked, `${item.name}.refsIn must not contain excluded subagent`).to.equal(false);
            }
        });
    });
});
