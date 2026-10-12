export const currencies = ['USD', 'KRW', 'EUR', 'JPY', 'CNY', 'GBP'] as const;
export type Currency = (typeof currencies)[number];
export const kinds = ['monthly', 'yearly', 'usage', 'once'] as const;
export type Kind = (typeof kinds)[number];
export const categories = [
  'cloud',
  'hosting',
  'database',
  'api',
  'email',
  'tools',
  'other',
] as const;
export type Category = (typeof categories)[number];
export type Service = {
  id: string;
  name: string;
  category: Category;
  project: string;
  url: string;
  notes: string;
  currency: Currency;
  amount: number;
  kind: Kind;
  anchor: string;
  end: string;
  paused: boolean;
};
export type Bill = Omit<Service, 'anchor' | 'end' | 'paused'> & {
  key: string;
  date: string;
  paidAt: string;
};
export type Ledger = {
  version: 1;
  services: Service[];
  payments: Bill[];
  base: Currency;
  rates: Partial<Record<Currency, number>>;
  budget: number;
};
export const MAX_AMOUNT = 100_000_000_000;
export const MAX_SERVICES = 500;
export const MAX_PAYMENTS = 5000;
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
export const STORAGE_KEY = 'billing-memo.ledger.v1';
export function digits(currency: Currency) {
  return currency === 'KRW' || currency === 'JPY' ? 0 : 2;
}
export function parseAmount(text: string, currency: Currency): number {
  const d = digits(currency);
  const re = d === 0 ? /^\d{1,12}$/ : /^\d{1,12}(?:\.\d{1,2})?$/;
  if (!re.test(text.trim())) throw new Error('amount');
  const [whole, fraction = ''] = text.trim().split('.');
  const value = Number(whole) * 10 ** d + Number(fraction.padEnd(d, '0'));
  if (!Number.isSafeInteger(value) || value > MAX_AMOUNT) throw new Error('amount');
  return value;
}
export function amountInput(amount: number, currency: Currency) {
  return (amount / 10 ** digits(currency)).toFixed(digits(currency));
}
export function money(amount: number, currency: Currency, locale = 'en') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    maximumFractionDigits: digits(currency),
  }).format(amount / 10 ** digits(currency));
}
export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(20\d{2}|21\d{2})-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validMonth(month: string) {
  return validDate(`${month}-01`);
}
export function shiftMonth(month: string, delta: number) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}
export function daysInMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export function safeUrl(value: string): string {
  if (!value.trim()) return '';
  if (value.length > 2000) throw new Error('url');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('url');
  return url.href;
}
export function blankLedger(): Ledger {
  return { version: 1, services: [], payments: [], base: 'USD', rates: { USD: 1 }, budget: 0 };
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));
function text(row: Record<string, unknown>, key: string, max: number, required = false): string {
  const val = row[key];
  if (
    typeof val !== 'string' ||
    val.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(val) ||
    (required && !val.trim())
  )
    throw new Error('invalid');
  return val.trim();
}
function member<T extends string>(value: unknown, options: readonly T[]): T {
  if (typeof value !== 'string' || !options.includes(value as T)) throw new Error('invalid');
  return value as T;
}
function amount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > MAX_AMOUNT)
    throw new Error('amount');
  return value;
}
function common(value: unknown): Omit<Service, 'anchor' | 'end' | 'paused'> {
  if (!isRecord(value)) throw new Error('invalid');
  const id = text(value, 'id', 80, true);
  if (!/^[\w-]+$/.test(id)) throw new Error('invalid');
  return {
    id,
    name: text(value, 'name', 80, true),
    category: member(value.category, categories),
    project: text(value, 'project', 60),
    url: safeUrl(text(value, 'url', 2000)),
    notes: text(value, 'notes', 2000),
    currency: member(value.currency, currencies),
    amount: amount(value.amount),
    kind: member(value.kind, kinds),
  };
}
export function validateService(value: unknown): Service {
  const data = common(value);
  const row = value as Record<string, unknown>;
  if (
    !validDate(row.anchor) ||
    (row.end !== '' && !validDate(row.end)) ||
    (row.end && String(row.end) < row.anchor) ||
    typeof row.paused !== 'boolean'
  )
    throw new Error('date');
  return { ...data, anchor: row.anchor, end: row.end as string, paused: row.paused };
}
export function validateLedger(value: unknown): Ledger {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.services) ||
    value.services.length > MAX_SERVICES ||
    !Array.isArray(value.payments) ||
    value.payments.length > MAX_PAYMENTS ||
    !isRecord(value.rates)
  )
    throw new Error('invalid');
  const services = value.services.map(validateService);
  if (new Set(services.map((s) => s.id)).size !== services.length) throw new Error('invalid');
  const payments = value.payments.map((raw): Bill => {
    const data = common(raw);
    if (
      !isRecord(raw) ||
      !validDate(raw.date) ||
      !validDate(raw.paidAt) ||
      raw.key !== `${data.id}@${raw.date}`
    )
      throw new Error('invalid');
    return { ...data, key: String(raw.key), date: raw.date, paidAt: raw.paidAt };
  });
  if (new Set(payments.map((p) => `${p.id}@${p.date.slice(0, 7)}`)).size !== payments.length)
    throw new Error('invalid');
  const base = member(value.base, currencies);
  const rates: Ledger['rates'] = {};
  for (const currency of currencies) {
    const rate = value.rates[currency];
    if (rate === undefined) continue;
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0 || rate > 1_000_000)
      throw new Error('rate');
    rates[currency] = rate;
  }
  if (rates[base] !== 1) throw new Error('rate');
  const result: Ledger = {
    version: 1,
    services,
    payments,
    base,
    rates,
    budget: amount(value.budget),
  };
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_BACKUP_BYTES)
    throw new Error('size');
  return result;
}
export function dueDate(service: Service, month: string): string | null {
  if (!validMonth(month) || service.paused || month < service.anchor.slice(0, 7)) return null;
  if (
    (service.kind === 'yearly' && month.slice(5) !== service.anchor.slice(5, 7)) ||
    (service.kind === 'once' && month !== service.anchor.slice(0, 7))
  )
    return null;
  const day = Math.min(Number(service.anchor.slice(8)), daysInMonth(month));
  const date = `${month}-${String(day).padStart(2, '0')}`;
  return service.end && date > service.end ? null : date;
}
export function billsFor(ledger: Ledger, month: string): Bill[] {
  const paid = ledger.payments.filter((p) => p.date.startsWith(month + '-'));
  // One recorded invoice supersedes the service estimate for that month, even after its anchor changes.
  const paidIds = new Set(paid.map((p) => p.id));
  const pending = ledger.services.flatMap((service) => {
    const date = dueDate(service, month);
    if (!date || paidIds.has(service.id)) return [];
    const { anchor: _a, end: _e, paused: _p, ...data } = service;
    return [{ ...data, key: `${service.id}@${date}`, date, paidAt: '' }];
  });
  return [...paid, ...pending].sort(
    (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name),
  );
}
export function converted(amount: number, currency: Currency, ledger: Ledger): number | null {
  const rate = ledger.rates[currency];
  return rate === undefined
    ? null
    : Math.round((amount / 10 ** digits(currency)) * rate * 10 ** digits(ledger.base));
}
export function totals(items: readonly { amount: number; currency: Currency }[], ledger: Ledger) {
  const byCurrency: Partial<Record<Currency, number>> = {};
  const missing = new Set<Currency>();
  let total = 0;
  for (const item of items) {
    byCurrency[item.currency] = (byCurrency[item.currency] ?? 0) + item.amount;
    const value = converted(item.amount, item.currency, ledger);
    if (value === null && item.amount > 0) missing.add(item.currency);
    else total += value ?? 0;
  }
  return { total, byCurrency, missing: [...missing] };
}
export function monthlyRunRate(ledger: Ledger, month: string) {
  return totals(
    ledger.services
      .filter(
        (s) =>
          !s.paused &&
          s.kind !== 'once' &&
          s.anchor.slice(0, 7) <= month &&
          (!s.end || s.end >= `${month}-01`),
      )
      .map((s) => ({
        currency: s.currency,
        amount: s.kind === 'yearly' ? s.amount / 12 : s.amount,
      })),
    ledger,
  );
}
export function settle(ledger: Ledger, bill: Bill, actual: number, paidAt = today()): Ledger {
  const next = {
    ...ledger,
    payments: [
      ...ledger.payments.filter(
        (p) => !(p.id === bill.id && p.date.slice(0, 7) === bill.date.slice(0, 7)),
      ),
      { ...bill, amount: actual, paidAt },
    ],
  };
  return validateLedger(next);
}
export function csvCell(value: unknown) {
  let text = String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
export function exportCsv(bills: readonly Bill[]): string {
  return (
    '\uFEFF' +
    [
      [
        'service',
        'project',
        'category',
        'due_date',
        'currency',
        'amount',
        'status',
        'recorded_on',
        'billing_type',
        'url',
        'notes',
      ],
      ...bills.map((b) => [
        b.name,
        b.project,
        b.category,
        b.date,
        b.currency,
        amountInput(b.amount, b.currency),
        b.paidAt ? 'paid' : 'estimated',
        b.paidAt,
        b.kind,
        b.url,
        b.notes,
      ]),
    ]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n')
  );
}
const icsText = (text: string) =>
  text
    .replaceAll('\\', '\\\\')
    .replaceAll('\r', '')
    .replaceAll('\n', '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,');
function fold(line: string) {
  let out = '',
    count = 0;
  for (const char of line) {
    const n = new TextEncoder().encode(char).length;
    if (count + n > 74) {
      out += '\r\n ';
      count = 1;
    }
    out += char;
    count += n;
  }
  return out;
}
export function exportIcs(
  bills: readonly Bill[],
  stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, ''),
) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Billing Memo//EN',
    'CALSCALE:GREGORIAN',
  ];
  for (const b of bills.filter((b) => !b.paidAt)) {
    const end = new Date(`${b.date}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${b.key.replace('@', '-')}@billing-memo`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${b.date.replaceAll('-', '')}`,
      `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replaceAll('-', '')}`,
      `SUMMARY:${icsText(`${b.name} · ${money(b.amount, b.currency)}`)}`,
      `DESCRIPTION:${icsText(b.notes)}`,
      ...(b.url ? [`URL:${b.url}`] : []),
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:-P3D',
      `DESCRIPTION:${icsText(b.name)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  return [...lines, 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}
