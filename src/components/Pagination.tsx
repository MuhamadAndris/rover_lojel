'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
  );

  // Insert ellipsis gaps
  const items: (number | '...')[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) items.push('...');
    items.push(p);
  });

  return (
    <div className="flex items-center justify-between px-1 pt-3 border-t border-ink-100">
      <p className="text-sm text-ink-400">
        Menampilkan <span className="font-medium text-ink-700">{from}–{to}</span> dari{' '}
        <span className="font-medium text-ink-700">{total}</span> data
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-500 hover:bg-ink-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {items.map((item, i) =>
          item === '...' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-ink-400 text-sm">
              …
            </span>
          ) : (
            <button
              key={item}
              onClick={() => onPageChange(item)}
              className={cn(
                'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                item === page
                  ? 'bg-brand-600 text-white'
                  : 'text-ink-600 hover:bg-ink-100'
              )}
            >
              {item}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-500 hover:bg-ink-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
