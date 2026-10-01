/**
 * The downloads offered beside the dictionary. Each is a PDF dropped into
 * src/assets/dictionary-resources/ under the file name below — nothing else to change.
 * The build lists whichever files are there; a resource whose file isn't there yet
 * shows as "Coming soon" with its buttons disabled. See that folder's README.
 */

const files = import.meta.glob<string>("/src/assets/dictionary-resources/*.pdf", { eager: true, query: "?url", import: "default" });

export type DictionaryResource = {
    id: string;
    title: string;
    description: string;
    /** The file's name in src/assets/dictionary-resources/. */
    file: string;
    /** What the downloaded file is called on the reader's machine. */
    downloadName: string;
    /** The built file's address, or null until the PDF is dropped in. */
    url: string | null;
};

const RESOURCES: Omit<DictionaryResource, "url">[] = [
    {
        id: "acumen-dictionary",
        title: "The HiddenGem Industry Acumen Dictionary",
        description: "The whole dictionary as one PDF.",
        file: "hgm-industry-acumen-dictionary.pdf",
        downloadName: "HiddenGem Industry Acumen Dictionary.pdf",
    },
    {
        id: "call-sheet",
        title: "Call sheet cheat sheet",
        description: "The Tier A terms on one sheet, for live calls.",
        file: "call-sheet-cheat-sheet.pdf",
        downloadName: "HiddenGem Call Sheet Cheat Sheet.pdf",
    },
    {
        id: "tech-stack",
        title: "Client tech stack guide",
        description: "The tools behind a client's setup, in one guide.",
        file: "client-tech-stack-guide.pdf",
        downloadName: "HiddenGem Client Tech Stack Guide.pdf",
    },
];

export const DICTIONARY_RESOURCES: DictionaryResource[] = RESOURCES.map((r) => ({ ...r, url: files[`/src/assets/dictionary-resources/${r.file}`] ?? null }));
