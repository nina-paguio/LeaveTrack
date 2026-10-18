import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * How a column appears in the stacked card below lg:
 * - `title`: the card heading (one per table). `badge`: sits to the right of the title.
 * - `line`: a plain line under the title, no label. `footer`: the full-width action row.
 * - `hidden`: left out of the card. Omitted: a labelled label/value pair.
 */
export type CardRole = "title" | "badge" | "line" | "footer" | "hidden";

export interface Column<T> {
  key: string;
  header: string;
  /** Return null/undefined for "nothing to show": a dash in the table, no row in the card. */
  render: (row: T) => ReactNode;
  card?: CardRole;
}

export interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Rendered instead of the table when `rows` is empty. */
  empty?: ReactNode;
}

const has = (node: ReactNode) =>
  node !== null && node !== undefined && node !== false && node !== "";

/** Table from lg up (md has a sidebar, leaving too little width); stacked cards below lg so nothing scrolls sideways. */
export function DataTable<T>({ caption, columns, rows, rowKey, empty }: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  const role = (c: Column<T>) => c.card;
  const title = columns.find((c) => role(c) === "title");
  const badge = columns.find((c) => role(c) === "badge");
  const lines = columns.filter((c) => role(c) === "line");
  const footer = columns.find((c) => role(c) === "footer");
  const fields = columns.filter((c) => !role(c));

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-border bg-surface shadow-card lg:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-border bg-background text-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className="px-4 py-3 font-medium">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-border last:border-0">
                {columns.map((c) => {
                  const value = c.render(row);
                  return (
                    <td key={c.key} className="px-4 py-3 align-top">
                      {has(value) ? value : <span aria-label="None">–</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 lg:hidden" aria-label={caption}>
        {rows.map((row) => {
          const footerValue = footer?.render(row);
          return (
            <li
              key={rowKey(row)}
              className="rounded-lg border border-border bg-surface p-4 shadow-card"
            >
              {title ? (
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-medium [overflow-wrap:anywhere]">
                    {title.render(row)}
                  </p>
                  {badge ? <div className="shrink-0">{badge.render(row)}</div> : null}
                </div>
              ) : null}
              {lines.map((c) => {
                const value = c.render(row);
                return has(value) ? (
                  <p key={c.key} className="mt-1 text-sm text-muted [overflow-wrap:anywhere]">
                    {value}
                  </p>
                ) : null;
              })}
              {fields.length ? (
                <dl className={cn("flex flex-col gap-1.5 text-sm", title && "mt-3")}>
                  {fields.map((c) => {
                    const value = c.render(row);
                    return has(value) ? (
                      <div key={c.key} className="flex justify-between gap-4">
                        <dt className="text-muted">{c.header}</dt>
                        <dd className="text-right [overflow-wrap:anywhere]">{value}</dd>
                      </div>
                    ) : null;
                  })}
                </dl>
              ) : null}
              {has(footerValue) ? <div className="mt-4">{footerValue}</div> : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
