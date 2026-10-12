import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billsFor, blankLedger, settle, type Service } from '../src/model.ts';
import {
  monthlyCsv,
  rangeMonths,
  reportCsv,
  reportFor,
  type ReportOptions,
} from '../src/reports.ts';
const options: ReportOptions = {
  start: '2024-01-01',
  end: '2024-03-31',
  basis: 'paid',
  category: '',
  project: '',
};
const service: Service = {
  id: 'cloud',
  name: 'Cloud',
  category: 'cloud',
  project: 'Alpha',
  url: '',
  notes: '',
  currency: 'USD',
  amount: 1000,
  kind: 'monthly',
  anchor: '2024-01-31',
  end: '',
  paused: false,
};
function fixture() {
  let ledger = { ...blankLedger(), services: [service] };
  ledger = settle(ledger, billsFor(ledger, '2024-01')[0], 1200, '2024-02-01');
  return settle(ledger, billsFor(ledger, '2024-02')[0], 700, '2024-03-31');
}
test('actual reports use payment date across month and range boundaries', () => {
  const result = reportFor(fixture(), options);
  assert.equal(result.summary.total, 1900);
  assert.deepEqual(
    result.months.map((m) => m.total),
    [0, 1200, 700],
  );
  assert.equal(result.average, 633);
  assert.equal(
    reportFor(fixture(), { ...options, start: '2024-02-01', end: '2024-02-01' }).summary.total,
    1200,
  );
  assert.equal(reportFor(fixture(), { ...options, end: '2024-03-30' }).summary.total, 1200);
});
test('scheduled reports use due dates, recorded amounts and unpaid estimates once each', () => {
  const result = reportFor(fixture(), { ...options, basis: 'scheduled' });
  assert.deepEqual(
    result.months.map((m) => m.total),
    [1200, 700, 1000],
  );
  assert.equal(result.paid.total, 1900);
  assert.equal(result.unpaid.total, 1000);
  assert.equal(
    reportFor(fixture(), { ...options, basis: 'scheduled', start: '2024-02-01', end: '2024-02-28' })
      .entries.length,
    0,
  );
});
test('paid snapshots survive deleted services and filter by original project/category', () => {
  const ledger = { ...fixture(), services: [] };
  assert.equal(
    reportFor(ledger, { ...options, project: 'Alpha', category: 'cloud' }).summary.total,
    1900,
  );
  assert.equal(reportFor(ledger, { ...options, project: 'Other' }).entries.length, 0);
  assert.equal(reportFor(ledger, { ...options, category: 'api' }).entries.length, 0);
});
test('empty and partial months count toward the disclosed monthly average', () => {
  const result = reportFor(fixture(), { ...options, start: '2024-02-01', end: '2024-04-01' });
  assert.deepEqual(
    result.months.map((m) => m.total),
    [1200, 700, 0],
  );
  assert.equal(result.average, 633);
});
test('monthly and period exports keep currencies and mark partial conversion', () => {
  const ledger = fixture();
  ledger.payments[0].currency = 'JPY';
  const result = reportFor(ledger, options);
  assert.deepEqual(result.summary.missing, ['JPY']);
  assert.equal(result.summary.total, 700);
  const csv = monthlyCsv(ledger, options);
  assert.equal(csv.split('\r\n').length, 4);
  assert.match(csv, /original_JPY/);
  assert.match(csv, /false/);
  ledger.rates.JPY = 0.01;
  assert.equal(reportFor(ledger, options).summary.total, 1900);
  ledger.payments[0].name = '=MALICIOUS()';
  assert.ok(reportCsv(ledger, options).includes("'=MALICIOUS()"));
  assert.ok(reportCsv(ledger, options).includes('2024-02-01'));
});
test('invalid, inverted and unbounded ranges are rejected', () => {
  for (const [start, end] of [
    ['2024-02-30', '2024-03-01'],
    ['2025-01-01', '2024-01-01'],
    ['2000-01-01', '2010-01-01'],
    ['', '2024-01-01'],
  ])
    assert.throws(() => rangeMonths(start, end));
  assert.equal(rangeMonths('2000-01-01', '2009-12-31').length, 120);
  assert.equal(rangeMonths('2199-12-31', '2199-12-31').length, 1);
});
