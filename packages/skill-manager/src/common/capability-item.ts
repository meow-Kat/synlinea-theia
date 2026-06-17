/**
 * A resolved reference from a capability item body.
 */
export interface CapabilityRef {
    /** The raw name as found in the body (slash-trigger, plain name, or [[link]] text). */
    name: string;
    /**
     * Whether the referred item is included in this scan.
     * Items referencing subagents (not scanned this cut) will have included=false.
     */
    included: boolean;
    /** Reason for exclusion, when included=false. */
    excludedReason?: 'subagent/not-included' | 'unknown';
}

/**
 * A single scanned capability — a skill file or a rules file.
 */
export interface CapabilityItem {
    /** Discriminator between a SKILL.md entry and a CLAUDE.md / rules entry. */
    type: 'skill' | 'rule';
    /** Human-readable name (from frontmatter `name` field, or derived from path). */
    name: string;
    /** Short description from frontmatter, or first non-empty line of body. */
    description: string;
    /** Absolute path on disk. */
    path: string;
    /** Whether the file lives under `~/.claude` or the workspace `.claude`. */
    source: 'global' | 'project';
    /** Skill trigger string, e.g. `/my-skill`. Only present for type=skill. */
    trigger?: string;
    /** tools array from frontmatter (skill only). */
    tools?: string[];
    /** model from frontmatter (skill only). */
    model?: string;
    /** Raw markdown body (entire file content, or body-after-frontmatter). */
    body: string;
    /** Forward refs: items this capability explicitly references. */
    refsOut: CapabilityRef[];
    /** Inbound refs: items that reference this capability. */
    refsIn: CapabilityRef[];
}
