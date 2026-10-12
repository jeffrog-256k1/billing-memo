import {
  amountInput,
  billsFor,
  currencies,
  csvCell,
  exportCsv,
  shiftMonth,
  totals,
  validDate,
  type Bill,
  type Category,
  type Ledger,
} from './model.ts';

export type ReportBasis = 'paid' | 'scheduled';
export type ReportOptions = {
  start: string;
  end: string;
  basis: ReportBasis;
  category: Category | '';
  project: string;
};
export function rangeMonths(start: string, end: string): string[] {
  if (!validDate(start) || !validDate(end) || start > end) throw new Error('range');
  const first = start.slice(0, 7),
    last = end.slice(0, 7);
  const count =
    (Number(last.slice(0, 4)) - Number(first.slice(0, 4))) * 12 +
    Number(last.slice(5)) -
    Number(first.slice(5)) +
    1;
  if (count > 120) throw new Error('range');
  return Array.from({ length: count }, (_, i) => shiftMonth(first, i));
}
export function reportFor(ledger: Ledger, options: ReportOptions) {
  const months = rangeMonths(options.start, options.end);
  if (!['paid', 'scheduled'].includes(options.basis)) throw new Error('basis');
  const dateOf = (bill: Bill) => (options.basis === 'paid' ? bill.paidAt : bill.date);
  const candidates =
    options.basis === 'paid' ? ledger.payments : months.flatMap((month) => billsFor(ledger, month));
  const entries = candidates
    .filter(
      (b) =>
        dateOf(b) >= options.start &&
        dateOf(b) <= options.end &&
        (!options.category || b.category === options.category) &&
        (!options.project || b.project === options.project),
    )
    .sort((a, b) => dateOf(a).localeCompare(dateOf(b)) || a.name.localeCompare(b.name));
  const buckets = months.map((month) => {
    const rows = entries.filter((b) => dateOf(b).startsWith(month + '-'));
    return { month, count: rows.length, ...totals(rows, ledger) };
  });
  const summary = totals(entries, ledger);
  return {
    entries,
    months: buckets,
    summary,
    paid: totals(
      entries.filter((b) => b.paidAt),
      ledger,
    ),
    unpaid: totals(
      entries.filter((b) => !b.paidAt),
      ledger,
    ),
    average: Math.round(summary.total / months.length),
  };
}
export function reportCsv(ledger: Ledger, options: ReportOptions) {
  // The existing export includes both scheduled and actual dates and the original currency.
  return exportCsv(reportFor(ledger, options).entries);
}
export function monthlyCsv(ledger: Ledger, options: ReportOptions) {
  const rows: unknown[][] = [
    [
      'month',
      'range_start',
      'range_end',
      'basis',
      'records',
      'base_currency',
      'converted_total',
      'conversion_complete',
      ...currencies.map((c) => 'original_' + c),
    ],
  ];
  for (const bucket of reportFor(ledger, options).months)
    rows.push([
      bucket.month,
      options.start,
      options.end,
      options.basis,
      bucket.count,
      ledger.base,
      amountInput(bucket.total, ledger.base),
      !bucket.missing.length,
      ...currencies.map((c) => amountInput(bucket.byCurrency[c] ?? 0, c)),
    ]);
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
