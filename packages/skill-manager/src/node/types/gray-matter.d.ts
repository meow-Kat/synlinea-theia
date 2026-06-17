declare module 'gray-matter' {
    interface GrayMatterFile {
        data: Record<string, unknown>;
        content: string;
        orig: string;
    }

    function matter(input: string, options?: object): GrayMatterFile;

    export = matter;
}
