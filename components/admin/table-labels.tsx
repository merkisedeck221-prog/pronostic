"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Header text of a column, without the sort arrows. */
function headerLabel(th: Element): string {
  return (th.textContent ?? "").replace(/[↑↓]/g, "").trim();
}

/** Copies each column header onto its cells (data-label), read by the phone card layout in globals.css. */
function labelTables(root: HTMLElement) {
  for (const table of root.querySelectorAll("table")) {
    const heads = Array.from(table.querySelectorAll(":scope > thead > tr:first-child > th")).map(headerLabel);
    if (heads.length === 0) continue;
    for (const row of table.querySelectorAll(":scope > tbody > tr")) {
      let column = 0;
      for (const cell of Array.from((row as HTMLTableRowElement).cells)) {
        const span = cell.colSpan || 1;
        const label = span === 1 ? heads[column] : "";
        if (label) {
          if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
        } else if (cell.hasAttribute("data-label")) {
          cell.removeAttribute("data-label");
        }
        if (span > 1) cell.setAttribute("data-wide", "");
        column += span;
      }
    }
  }
}

/**
 * Admin content area. On phones, tables are shown as cards (CSS in
 * globals.css, under [data-admin-content]); this wrapper labels each cell
 * with its column header, and keeps doing so when the rows change.
 */
export function AdminContent({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    labelTables(root);
    const observer = new MutationObserver(() => labelTables(root));
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return (
    <main ref={ref} id="contenu" tabIndex={-1} data-admin-content className="flex min-w-0 flex-1 outline-none">
      {children}
    </main>
  );
}
