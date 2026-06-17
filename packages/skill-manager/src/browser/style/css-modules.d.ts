/** Allow CSS imports in TypeScript files (handled by webpack at build time). */
declare module '*.css' {
    const content: Record<string, string>;
    export default content;
}
