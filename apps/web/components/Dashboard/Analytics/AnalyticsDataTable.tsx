'use client';

import * as React from 'react';

import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface AnalyticsDataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  pageSize?: number;
}

export default function AnalyticsDataTable<TData>({
  columns,
  data,
  searchPlaceholder,
  emptyMessage,
  className,
  pageSize = 20,
}: AnalyticsDataTableProps<TData>) {
  const t = useTranslations('TeacherAnalytics');
  const resolvedPlaceholder = searchPlaceholder ?? t('table.searchDefault');
  const resolvedEmpty = emptyMessage ?? t('table.emptyDefault');
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize });

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const normalizedFilter = String(filterValue).toLowerCase();
      return row
        .getVisibleCells()
        .some((cell) => String(cell.getValue() ?? '').toLowerCase().includes(normalizedFilter));
    },
  });

  const rows = table.getRowModel().rows;
  const totalFiltered = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const from = pageIndex * currentPageSize + 1;
  const to = Math.min(from + rows.length - 1, totalFiltered);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={globalFilter}
            onChange={(event) => {
              setGlobalFilter(event.target.value);
              // Reset to first page when filtering
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            placeholder={resolvedPlaceholder}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-slate-500">
          {totalFiltered > 0
            ? t('table.showingRows', { from, to, total: totalFiltered })
            : t('table.visibleRows', { count: 0 })}
        </div>
      </div>

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sortState = header.column.getIsSorted();

                return (
                  <TableHead key={header.id} className="bg-slate-50/80">
                    {header.isPlaceholder ? null : canSort ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-8 px-2 text-left font-medium"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortState === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : sortState === 'desc' ? (
                          <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </Button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="align-top whitespace-normal">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-28 text-center text-sm text-slate-500">
                {resolvedEmpty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('table.prev')}
          </Button>
          <span className="text-sm text-slate-600">
            {t('table.page', { current: pageIndex + 1, total: pageCount })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {t('table.next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
