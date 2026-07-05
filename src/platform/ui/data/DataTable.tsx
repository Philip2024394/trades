// DataTable — responsive table with mobile card fallback.
//
// Real tables lose on mobile — columns squeeze, text truncates,
// touch targets shrink. This component renders a proper <table>
// from md: up, and falls back to a stack of labelled rows on mobile.
//
// Rows are typed by column key so consumers get type-safe data.

import type { ReactNode } from "react";
import { CARD_RADIUS } from "../tokens";

export type DataTableColumn<T> = {
  key: keyof T & string;
  header: string;
  /** Render override for this cell. Defaults to `String(row[key])`. */
  render?: (row: T) => ReactNode;
  /** Text alignment for the column. */
  align?: "left" | "right" | "center";
  /** Show / hide on mobile (mobile hides the whole thing anyway —
   *  this hides even from the mobile card variant). */
  hideOnMobile?: boolean;
  /** Fixed column width — px or CSS value. */
  width?: string | number;
};

export type DataTableProps<T> = {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  /** Extract a stable React key. */
  getRowKey: (row: T) => string;
  /** Row click handler — turns rows into buttons on mobile + hover
   *  states on desktop. */
  onRowClick?: (row: T) => void;
  /** Rendered when rows is empty. */
  emptyState?: ReactNode;
  /** Optional title above the table. */
  title?: string;
  /** Optional right-aligned action next to the title (filter chip, etc). */
  titleTrailing?: ReactNode;
};

function cellContent<T>(col: DataTableColumn<T>, row: T): ReactNode {
  if (col.render) return col.render(row);
  const value = row[col.key];
  return value == null ? "" : String(value);
}

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center"
} as const;

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyState,
  title,
  titleTrailing
}: DataTableProps<T>) {
  const mobileCols = columns.filter((c) => !c.hideOnMobile);
  const primaryCol = mobileCols[0];
  const secondaryCols = mobileCols.slice(1);
  return (
    <div>
      {(title || titleTrailing) ? (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {title ? (
            <h3 className="text-[15px] font-semibold text-neutral-900">
              {title}
            </h3>
          ) : (
            <span />
          )}
          {titleTrailing ? <div>{titleTrailing}</div> : null}
        </div>
      ) : null}

      {rows.length === 0 && emptyState ? (
        emptyState
      ) : (
        <>
          {/* Mobile: stacked card variant */}
          <ul className={`flex flex-col gap-2 md:hidden`}>
            {rows.map((row) => {
              const inner = (
                <div
                  className={`${CARD_RADIUS} border border-neutral-200 bg-white p-3`}
                >
                  {primaryCol ? (
                    <div className="text-[14px] font-medium text-neutral-900">
                      {cellContent(primaryCol, row)}
                    </div>
                  ) : null}
                  {secondaryCols.length ? (
                    <dl className="mt-2 flex flex-col gap-1 text-[12px]">
                      {secondaryCols.map((col) => (
                        <div
                          key={col.key}
                          className="flex items-baseline gap-2"
                        >
                          <dt className="w-24 shrink-0 text-neutral-500">
                            {col.header}
                          </dt>
                          <dd className="min-w-0 flex-1 text-neutral-800">
                            {cellContent(col, row)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
              );
              if (onRowClick) {
                return (
                  <li key={getRowKey(row)}>
                    <button
                      type="button"
                      onClick={() => onRowClick(row)}
                      className="w-full text-left"
                    >
                      {inner}
                    </button>
                  </li>
                );
              }
              return <li key={getRowKey(row)}>{inner}</li>;
            })}
          </ul>

          {/* Desktop: real table */}
          <div
            className={`hidden overflow-hidden ${CARD_RADIUS} border border-neutral-200 bg-white md:block`}
          >
            <table className="w-full text-[13px]">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={col.width ? { width: col.width } : undefined}
                      className={`px-4 py-2.5 ${alignClass[col.align ?? "left"]} text-[11px] font-semibold uppercase tracking-wide text-neutral-500`}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={getRowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`border-b border-neutral-100 last:border-0 ${
                      onRowClick ? "cursor-pointer hover:bg-neutral-50" : ""
                    }`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 ${alignClass[col.align ?? "left"]} text-neutral-800`}
                      >
                        {cellContent(col, row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
