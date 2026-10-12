import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  amountInput,
  billsFor,
  blankLedger,
  dueDate,
  exportCsv,
  exportIcs,
  monthlyRunRate,
  parseAmount,
  safeUrl,
  settle,
  totals,
  validateLedger,
  validateService,
  validDate,
  type Service,
} from '../src/model.ts';
import { languages, translationKeys, translate } from '../src/i18n.ts';
import { sampleLedger } from '../src/sample.ts';
const service = (patch: Partial<Service> = {}): Service => ({
  id: 'test',
  name: 'Test',
  url: 'https://example.com/billing',
  category: 'cloud',
  project: 'Lab',
  amount: 1000,
  currency: 'USD',
  kind: 'monthly',
  anchor: '2024-01-31',
  end: '',
  paused: false,
  notes: '',
  ...patch,
});
const ledger = (s = service()) => ({ ...blankLedger(), services: [s] });
for (const [input, currency, result] of [
  ['0.29', 'USD', 29],
  ['12.3', 'EUR', 1230],
  ['45000', 'KRW', 45000],
  ['300', 'JPY', 300],
  ['0', 'CNY', 0],
] as const)
  test(`exact minor units: ${input} ${currency}`, () =>
    assert.equal(parseAmount(input, currency), result));
for (const input of ['-1', '1e2', 'NaN', 'Infinity', '1,000', '0.001', '999999999999999', ''])
  test(`reject amount ${input}`, () => assert.throws(() => parseAmount(input, 'USD')));
test('zero-decimal currencies reject fractional units', () =>
  assert.throws(() => parseAmount('1.5', 'JPY')));
test('round trip amount text', () =>
  assert.equal(amountInput(parseAmount('0.29', 'USD'), 'USD'), '0.29'));
test('month-end recurrences do not drift after February', () => {
  const s = service();
  assert.equal(dueDate(s, '2024-02'), '2024-02-29');
  assert.equal(dueDate(s, '2024-03'), '2024-03-31');
  assert.equal(dueDate(s, '2025-02'), '2025-02-28');
});
test('annual leap day uses last day in ordinary years', () =>
  assert.equal(
    dueDate(service({ kind: 'yearly', anchor: '2024-02-29' }), '2025-02'),
    '2025-02-28',
  ));
test('annual cost bills once and normalizes separately', () => {
  const l = ledger(service({ kind: 'yearly', amount: 12000 }));
  assert.equal(billsFor(l, '2024-02').length, 0);
  assert.equal(totals(billsFor(l, '2025-01'), l).total, 12000);
  assert.equal(monthlyRunRate(l, '2024-02').total, 1000);
});
test('one-time cost never recurs or enters run rate', () => {
  const l = ledger(service({ kind: 'once' }));
  assert.equal(billsFor(l, '2024-01').length, 1);
  assert.equal(billsFor(l, '2025-01').length, 0);
  assert.equal(monthlyRunRate(l, '2024-01').total, 0);
});
test('before anchor, after end and paused estimates excluded', () => {
  assert.equal(dueDate(service(), '2023-12'), null);
  assert.equal(dueDate(service({ end: '2024-02-15' }), '2024-02'), null);
  assert.equal(dueDate(service({ end: '2024-02-29' }), '2024-02'), '2024-02-29');
  assert.equal(dueDate(service({ paused: true }), '2024-03'), null);
});
test('actual usage replaces monthly estimate, including zero actual', () => {
  const l = ledger(service({ kind: 'usage' })),
    b = billsFor(l, '2024-03')[0];
  const paid = settle(l, b, 2500, '2024-04-01');
  assert.equal(totals(billsFor(paid, '2024-03'), paid).total, 2500);
  assert.equal(billsFor(paid, '2024-04')[0].amount, 1000);
  assert.equal(totals(billsFor(settle(l, b, 0, '2024-03-31'), '2024-03'), l).total, 0);
});
test('paid snapshots survive edits, shifted dates, pause and deletion', () => {
  const l = ledger(),
    paid = settle(l, billsFor(l, '2024-03')[0], 1300, '2024-03-31');
  paid.services[0] = {
    ...service(),
    name: 'New',
    amount: 9000,
    anchor: '2024-01-15',
    paused: true,
  };
  const b = billsFor(paid, '2024-03');
  assert.equal(b.length, 1);
  assert.equal(b[0].name, 'Test');
  assert.equal(b[0].amount, 1300);
  paid.services = [];
  assert.equal(billsFor(paid, '2024-03').length, 1);
});
test('settling a recorded invoice is idempotent', () => {
  const l = ledger(),
    p = settle(l, billsFor(l, '2024-01')[0], 1000);
  assert.equal(settle(p, p.payments[0], 1200).payments.length, 1);
});
test('mixed currencies stay separate until rates supplied', () => {
  const l = blankLedger(),
    s = totals(
      [
        { amount: 1000, currency: 'USD' },
        { amount: 14000, currency: 'KRW' },
      ],
      l,
    );
  assert.equal(s.total, 1000);
  assert.deepEqual(s.missing, ['KRW']);
  assert.equal(s.byCurrency.KRW, 14000);
  l.rates.KRW = 1 / 1400;
  assert.equal(totals([{ amount: 14000, currency: 'KRW' }], l).total, 1000);
});
test('zero foreign amounts do not invalidate sum', () =>
  assert.deepEqual(totals([{ amount: 0, currency: 'JPY' }], blankLedger()).missing, []));
test('strict dates reject rollover and invalid leap years', () => {
  assert.equal(validDate('2025-02-29'), false);
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2024-13-01'), false);
  assert.equal(validDate('1900-01-01'), false);
});
for (const url of [
  'javascript:alert(1)',
  'data:text/html,test',
  'https://user:pass@example.com',
  'http://example.com',
])
  test(`reject unsafe URL ${url.split(':')[0]}`, () => assert.throws(() => safeUrl(url)));
test('URLs are optional and valid HTTPS paths kept', () => {
  assert.equal(safeUrl(''), '');
  assert.equal(
    safeUrl('https://example.com/billing?team=demo'),
    'https://example.com/billing?team=demo',
  );
});
test('invalid date ranges and negative amounts fail validation', () => {
  assert.throws(() => validateService(service({ end: '2023-12-01' })));
  assert.throws(() => validateService(service({ amount: -2 })));
});
test('duplicate IDs and invoice months are rejected', () => {
  assert.throws(() => validateLedger({ ...ledger(), services: [service(), service()] }));
  const l = settle(ledger(), billsFor(ledger(), '2024-01')[0], 1000);
  assert.throws(() =>
    validateLedger({
      ...l,
      payments: [...l.payments, { ...l.payments[0], key: 'test@2024-01-15', date: '2024-01-15' }],
    }),
  );
});
test('unknown versions, invalid rates and oversized notes rejected', () => {
  assert.throws(() => validateLedger({ ...blankLedger(), version: 2 }));
  assert.throws(() => validateLedger({ ...blankLedger(), rates: { USD: 2 } }));
  assert.throws(() => validateLedger({ ...blankLedger(), rates: { USD: 1, EUR: Infinity } }));
  assert.throws(() => validateLedger(ledger(service({ notes: 'x'.repeat(2001) }))));
});
test('backups round trip with currency and snapshots', () => {
  const l = sampleLedger('2026-10');
  assert.deepEqual(validateLedger(JSON.parse(JSON.stringify(l))), l);
});
test('unsafe spreadsheet formula prefixes are neutralized', () => {
  const b = billsFor(ledger(service({ name: '=HYPERLINK("bad")', notes: '+SUM(1,2)' })), '2024-03');
  const csv = exportCsv(b);
  assert.ok(csv.includes('"\'=HYPERLINK'));
  assert.ok(csv.includes('"\'+SUM(1,2)"'));
});
test('calendar exports unpaid bills only, escaped text, proper date range and alarm', () => {
  const l = sampleLedger('2026-10'),
    ics = exportIcs(billsFor(l, '2026-10'), '20260101T000000Z');
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 6);
  assert.ok(ics.includes('TRIGGER:-P3D'));
  assert.ok(!ics.includes('SUMMARY:Cloudflare'));
  const b = billsFor(ledger(service({ name: 'A, B; C\nTest' })), '2024-12');
  const end = exportIcs(b);
  assert.ok(end.includes('DTEND;VALUE=DATE:20250101'));
  assert.ok(end.includes('SUMMARY:A\\, B\\; C\\nTest'));
});
test('calendar folds Unicode lines to RFC octet limits', () => {
  const ics = exportIcs(billsFor(ledger(service({ name: '한글'.repeat(30) })), '2024-03'));
  assert.ok(ics.split('\r\n').every((line) => Buffer.byteLength(line) <= 75));
});
test('every UI phrase exists in all five languages', () => {
  for (const key of translationKeys)
    for (const lang of languages) assert.ok(translate(key, lang)?.length, `${key}:${lang}`);
});
