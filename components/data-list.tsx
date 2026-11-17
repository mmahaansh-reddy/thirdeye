"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
  /** Card layout: "title" shows the value at the top without a label, "full" spans the card's width, "hide" omits it. */
  card?: "title" | "full" | "hide";
  /** Keep clicks on this cell (buttons, links, dropdowns) from triggering the row click. */
  stop?: boolean;
}

type Breakpoint = "md" | "lg" | "xl";
const SHOW_TABLE: Record<Breakpoint, string> = { md: "hidden md:block", lg: "hidden lg:block", xl: "hidden xl:block" };
const SHOW_CARDS: Record<Breakpoint, string> = { md: "md:hidden", lg: "lg:hidden", xl: "xl:hidden" };

/**
 * A list that always fits the screen: a wrapping table at or above `breakpoint`, one card per row below it.
 * Never scrolls sideways. `bare` skips the outer card (for use inside an existing card).
 */
export function DataList<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  breakpoint = "lg",
  bare = false,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  breakpoint?: Breakpoint;
  bare?: boolean;
}) {
  const wrap = (c: Column<T>, row: T) => {
    const content = c.cell(row);
    return c.stop ? <div onClick={(e) => e.stopPropagation()}>{content}</div> : content;
  };

  const table = (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((c) => (
            <TableHead key={c.header} className={cn("whitespace-normal", c.align === "right" && "text-right")}>
              {c.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={rowKey(row)}
            id={rowKey(row)}
            className={cn(onRowClick && "cursor-pointer")}
            tabIndex={onRowClick ? 0 : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(row) : undefined}
          >
            {columns.map((c) => (
              <TableCell key={c.header} className={cn("align-top whitespace-normal", c.align === "right" && "text-right tabular-nums")}>
                {wrap(c, row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const titleCols = columns.filter((c) => c.card === "title");
  const bodyCols = columns.filter((c) => c.card !== "title" && c.card !== "hide");

  return (
    <>
      <div className={SHOW_TABLE[breakpoint]}>
        {bare ? (
          table
        ) : (
          <Card className="py-2">
            <CardContent className="px-2">{table}</CardContent>
          </Card>
        )}
      </div>

      <div className={cn("grid gap-3 md:grid-cols-2", SHOW_CARDS[breakpoint])}>
        {rows.map((row) => (
          <Card
            key={rowKey(row)}
            className={cn("gap-3 py-4", onRowClick && "hover:border-ring cursor-pointer transition-colors")}
            tabIndex={onRowClick ? 0 : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(row) : undefined}
          >
            <CardContent className="space-y-3">
              {titleCols.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {titleCols.map((c) => (
                    <div key={c.header}>{wrap(c, row)}</div>
                  ))}
                </div>
              )}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                {bodyCols.map((c) => (
                  <div key={c.header} className={cn("min-w-0", c.card === "full" && "col-span-2")}>
                    <dt className="text-muted-foreground text-xs">{c.header}</dt>
                    <dd>{wrap(c, row)}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
