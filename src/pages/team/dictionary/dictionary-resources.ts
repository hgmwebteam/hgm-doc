/**
 * The downloads offered beside the dictionary. Each is a PDF dropped into
 * src/assets/dictionary-resources/ under the name below — nothing else to change. The
 * session slides also carry a PowerPoint copy beside the PDF, under the same name with
 * .pptx, speaker notes and all. The build lists whichever files are there; a file that
 * isn't there yet shows its buttons disabled, under "Coming soon". See that folder's README.
 */

const files = import.meta.glob<string>("/src/assets/dictionary-resources/*.{pdf,pptx}", { eager: true, query: "?url", import: "default" });

export type ResourceFormat = "pdf" | "pptx";

export type ResourceFile = {
    format: ResourceFormat;
    /** What the downloaded file is called on the reader's machine. */
    downloadName: string;
    /** The built file's address, or null until it is dropped in. */
    url: string | null;
};

export type DictionaryResource = {
    id: string;
    /** Reference documents first, then the slides from the training sessions. */
    group: "reference" | "slides";
    title: string;
    description: string;
    /** The PDF, which View opens; every resource has one. */
    pdf: ResourceFile;
    /** The PowerPoint copy, for the session slides only. */
    pptx?: ResourceFile;
};

type ResourceSpec = Omit<DictionaryResource, "pdf" | "pptx"> & {
    /** The file name in src/assets/dictionary-resources/, without its extension. */
    name: string;
    /** The downloaded file's name, without its extension. */
    downloadName: string;
    /** Also offer the .pptx beside the PDF. */
    pptx?: true;
};

const RESOURCES: ResourceSpec[] = [
    {
        id: "acumen-dictionary",
        group: "reference",
        title: "The HiddenGem Industry Acumen Dictionary",
        description: "The whole dictionary as one PDF.",
        name: "hgm-industry-acumen-dictionary",
        downloadName: "HiddenGem Industry Acumen Dictionary",
    },
    {
        id: "call-sheet",
        group: "reference",
        title: "Call sheet cheat sheet",
        description: "The Tier A terms on one sheet, for live calls.",
        name: "call-sheet-cheat-sheet",
        downloadName: "HiddenGem Call Sheet Cheat Sheet",
    },
    {
        id: "tech-stack",
        group: "reference",
        title: "Client tech stack guide",
        description: "The tools behind a client's setup, in one guide.",
        name: "client-tech-stack-guide",
        downloadName: "HiddenGem Client Tech Stack Guide",
    },
    {
        id: "session-1-slides",
        group: "slides",
        title: "Session 1 slides",
        description: "Sixteen terms: from rate to profit, setting the price, when guests book.",
        name: "industry-acumen-session-1-slides",
        downloadName: "HiddenGem Industry Acumen Session 1 Slides",
        pptx: true,
    },
    {
        id: "session-2-slides",
        group: "slides",
        title: "Session 2 slides",
        description: "Fourteen terms: why direct pays, is the marketing working, the stack.",
        name: "industry-acumen-session-2-slides",
        downloadName: "HiddenGem Industry Acumen Session 2 Slides",
        pptx: true,
    },
];

const fileOf = (name: string, downloadName: string, format: ResourceFormat): ResourceFile => ({
    format,
    downloadName: `${downloadName}.${format}`,
    url: files[`/src/assets/dictionary-resources/${name}.${format}`] ?? null,
});

export const DICTIONARY_RESOURCES: DictionaryResource[] = RESOURCES.map(({ name, downloadName, pptx, ...r }) => ({
    ...r,
    pdf: fileOf(name, downloadName, "pdf"),
    ...(pptx ? { pptx: fileOf(name, downloadName, "pptx") } : {}),
}));
