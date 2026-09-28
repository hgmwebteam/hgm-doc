import { useMemo, useState } from "react";
import { ArrowDown, SearchSm, XClose } from "@untitledui/icons";
import { motion } from "motion/react";
import { cx } from "@/utils/cx";
import { type DirectoryClient, type SortKey, clientId, liveState, managerOf, matchesQuery, sortClients, tagState } from "./directory-model";
import { EASE_SOFT, HostingBadge, MetaMark, StateBadge } from "./directory-ui";

const COLUMNS: { key: SortKey; label: string; center?: boolean }[] = [
    { key: "name", label: "Client" },
    { key: "live", label: "Live", center: true },
    { key: "tags", label: "Meta tags", center: true },
    { key: "platform", label: "Hosting", center: true },
    { key: "manager", label: "Account manager" },
];

/** Every client in scope as one sortable table; a row opens the client. Rows settle in one after another. */
/** The table's search, in the toolbar where the picker sits in the Overview: 40px, level with the tabs and button. */
export const TableSearch = ({ query, onChange, shown, total }: { query: string; onChange: (q: string) => void; shown: number; total: number }) => (
    <label className="flex h-10 w-full items-center gap-2 rounded-lg border border-secondary bg-primary pr-1 pl-3 shadow-xs transition duration-100 ease-linear focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
        <SearchSm className="size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
        <input
            type="search"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Escape") onChange("");
            }}
            placeholder="Search clients"
            aria-label="Search clients"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-placeholder [&::-webkit-search-cancel-button]:hidden"
        />
        <span className="shrink-0 pr-2 text-xs text-tertiary">{query.trim() ? `${shown} of ${total}` : total} clients</span>
        {query && (
            <button
                type="button"
                onClick={() => onChange("")}
                aria-label="Clear search"
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-tertiary transition duration-100 ease-linear hover:bg-secondary hover:text-primary"
            >
                <XClose className="size-4" aria-hidden="true" />
            </button>
        )}
    </label>
);

export const ClientsTable = ({
    clients,
    scoped,
    query,
    onOpen,
}: {
    clients: DirectoryClient[];
    scoped: boolean;
    query: string;
    onOpen: (id: string) => void;
}) => {
    const [sortKey, setSortKey] = useState<SortKey>("name");
    const [dir, setDir] = useState<1 | -1>(1);

    const rows = useMemo(
        () =>
            sortClients(
                clients.filter((c) => matchesQuery(c, query)),
                sortKey,
                dir,
            ),
        [clients, query, sortKey, dir],
    );
    // Viewing as one manager: every row has the same manager, so the column says nothing.
    const columns = scoped ? COLUMNS.filter((c) => c.key !== "manager") : COLUMNS;

    const toggleSort = (key: SortKey) => {
        if (key === sortKey) setDir((d) => (d === 1 ? -1 : 1));
        else {
            setSortKey(key);
            setDir(1);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div data-pop className="overflow-hidden rounded-2xl border border-secondary bg-primary shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-secondary">
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        scope="col"
                                        aria-sort={sortKey === col.key ? (dir === 1 ? "ascending" : "descending") : "none"}
                                        className={cx(
                                            "px-4 py-3 text-xs font-medium whitespace-nowrap text-tertiary",
                                            col.center ? "text-center" : "text-left",
                                        )}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => toggleSort(col.key)}
                                            className={cx(
                                                "relative inline-flex items-center gap-1.5 transition duration-100 ease-linear hover:text-primary",
                                                sortKey === col.key && "font-semibold text-primary",
                                            )}
                                        >
                                            {col.label}
                                            <ArrowDown
                                                className={cx(
                                                    "size-3 transition duration-100",
                                                    // Hung outside a centred label, so the label itself sits dead centre.
                                                    col.center && "absolute -right-4.5",
                                                    sortKey === col.key ? "opacity-100" : "opacity-0",
                                                    sortKey === col.key && dir === -1 && "rotate-180",
                                                )}
                                                aria-hidden="true"
                                            />
                                        </button>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((c, i) => (
                                <motion.tr
                                    data-pop={i < 12 || undefined}
                                    key={clientId(c)}
                                    onClick={() => onOpen(clientId(c))}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.36, ease: EASE_SOFT, delay: Math.min(i, 10) * 0.025 }}
                                    className="cursor-pointer border-t border-secondary transition-colors duration-100 ease-linear hover:bg-secondary"
                                >
                                    <td className="px-4 py-3 text-sm font-medium text-primary">{c.name}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-center">
                                            <StateBadge state={liveState(c)} />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {/* Added is the Meta mark, as on the cards; only a gap gets words. */}
                                        <div className="flex justify-center">{c.metaTags ? <MetaMark added /> : <StateBadge state={tagState(c)} />}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-center">
                                            <HostingBadge platform={c.platform} />
                                        </div>
                                    </td>
                                    {!scoped && (
                                        <td className="px-4 py-3 text-sm text-secondary">{managerOf(c) || <span className="text-quaternary">—</span>}</td>
                                    )}
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {rows.length === 0 && (
                    <p className="px-4 py-6 text-sm text-tertiary">
                        No clients match <b className="font-medium text-primary">{query.trim()}</b>.
                    </p>
                )}
            </div>
        </div>
    );
};
