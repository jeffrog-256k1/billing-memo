import { categories, money, shiftMonth, today, type Currency, type Ledger } from './model.ts';
import { translate, type Key, type Language } from './i18n.ts';
import { monthlyCsv, reportCsv, reportFor, type ReportOptions } from './reports.ts';

export type ReportState = { options: ReportOptions; page: number };
export const newReportState = (): ReportState => ({
  options: {
    start: today().slice(0, 4) + '-01-01',
    end: today(),
    basis: 'paid',
    category: '',
    project: '',
  },
  page: 0,
});
const escape = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function mountReports(
  root: HTMLElement,
  ledger: Ledger,
  lang: Language,
  state: ReportState,
  download: (content: string, name: string, type?: string) => void,
) {
  const t = (k: Key) => escape(translate(k, lang));
  const format = (n: number, c: Currency = ledger.base) => escape(money(n, c, lang));
  const o = state.options;
  const report = reportFor(ledger, o);
  const native = (values: Partial<Record<Currency, number>>) =>
    Object.entries(values)
      .map(([c, v]) => format(v!, c as Currency))
      .join(' · ') || '—';
  const projects = [
    ...new Set([...ledger.services, ...ledger.payments].map((s) => s.project).filter(Boolean)),
  ].sort();
  const selector = (
    id: string,
    label: Key,
    values: readonly string[],
    value: string,
    localize = false,
  ) =>
    `<label class="field">${t(label)}<select name="${id}"><option value="">${t(id === 'project' ? 'allProjects' : 'allCategories')}</option>${values.map((v) => `<option value="${escape(v)}" ${v === value ? 'selected' : ''}>${localize ? t(v as Key) : escape(v)}</option>`).join('')}</select></label>`;
  const max = Math.max(1, ...report.months.map((m) => m.total));
  const totalPages = Math.max(1, Math.ceil(report.entries.length / 50));
  state.page = Math.max(0, Math.min(state.page, totalPages - 1));
  const redraw = () => mountReports(root, ledger, lang, state, download);
  root.innerHTML = `<header class="report-intro"><p class="eyebrow">04 / ${t('reports')}</p><h1>${t('periodTitle')}</h1><p class="intro">${t('periodHint')}</p></header>
    <form id="report-form" class="report-form"><label class="field">${t('startDate')}<input required type="date" name="start" min="2000-01-01" max="2199-12-31" value="${o.start}"/></label><label class="field">${t('endDate')}<input required type="date" name="end" min="2000-01-01" max="2199-12-31" value="${o.end}"/></label><label class="field">${t('basis')}<select name="basis"><option value="paid" ${o.basis === 'paid' ? 'selected' : ''}>${t('actualBasis')}</option><option value="scheduled" ${o.basis === 'scheduled' ? 'selected' : ''}>${t('scheduleBasis')}</option></select></label>${selector('project', 'project', projects, o.project)}${selector('category', 'category', categories, o.category, true)}<button class="primary" type="submit">${t('applyRange')} ↗</button><div class="report-presets"><button type="button" data-period="month">${t('thisMonth')}</button><button type="button" data-period="year">${t('thisYear')}</button><button type="button" data-period="twelve">${t('lastYear')}</button></div><p class="form-error full" id="range-error" role="alert" hidden>${t('rangeError')}</p></form>
    <div id="report-results" aria-live="polite"><div class="report-scope"><span>${o.start} → ${o.end}</span><span>${t(o.basis === 'paid' ? 'actualBasis' : 'scheduleBasis')}${o.project ? ' / ' + escape(o.project) : ''}${o.category ? ' / ' + t(o.category) : ''}</span></div>
    <section class="stats report-stats"><div class="stat"><p class="micro">${t('periodTotal')}</p><div class="stat-value" id="period-total">${report.summary.missing.length ? '≈ ' : ''}${format(report.summary.total)}</div><p class="hint">${t(o.basis === 'paid' ? 'actualHint' : 'scheduledHint')}</p></div><div class="stat"><p class="micro">${t('monthAverage')}</p><div class="stat-value">${report.summary.missing.length ? '≈ ' : ''}${format(report.average)}</div><p class="hint">${t('averageHint')}</p></div><div class="stat"><p class="micro">${t('records')}</p><div class="stat-value">${report.entries.length}</div><p class="hint">${t('paid')}: ${report.entries.filter((b) => b.paidAt).length} / ${t('estimated')}: ${report.entries.filter((b) => !b.paidAt).length}</p></div></section>
    ${report.summary.missing.length ? `<p class="rate-warning">${t('reportMissing')} (${escape(report.summary.missing.join(', '))})</p>` : ''}<div class="native-totals">${native(report.summary.byCurrency)}${Object.keys(report.summary.byCurrency).some((c) => c !== ledger.base) ? ` · ${t('converted')}` : ''}</div>
    <section><header class="panel-head"><h2>${t('monthlyTotals')}</h2><button id="monthly-csv">↓ ${t('monthExport')}</button></header><div class="monthly-report">${report.months.map((bucket) => `<article class="month-row"><time datetime="${bucket.month}">${escape(new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(bucket.month + '-01T00:00:00Z')))}</time><svg viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="dots-${bucket.month}" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#20251e"/></pattern></defs><rect width="300" height="24" fill="#e8eadf"/><rect width="${(bucket.total / max) * 300}" height="24" fill="#d8f58a"/><rect width="${(bucket.total / max) * 300}" height="24" fill="url(#dots-${bucket.month})"/></svg><div><b>${bucket.missing.length ? '≈ ' : ''}${format(bucket.total)}</b><small>${bucket.count} ${t('items')}</small></div><p class="hint">${native(bucket.byCurrency)}</p></article>`).join('')}</div></section>
    <section><header class="panel-head"><h2>${t('records')}</h2><button id="period-csv">↓ ${t('reportExport')}</button></header>${
      report.entries.length
        ? `<div class="report-table-wrap" tabindex="0" role="region" aria-label="${t('records')}"><table class="report-table"><thead><tr><th>${t('service')}</th><th>${t('due')}</th><th>${t('recordedOn')}</th><th>${t('amount')}</th></tr></thead><tbody>${report.entries
            .slice(state.page * 50, (state.page + 1) * 50)
            .map(
              (b) =>
                `<tr><td><strong>${escape(b.name)}</strong><small>${escape(b.project)} · ${t(b.category)} · ${t(b.paidAt ? 'paid' : 'estimated')}</small></td><td>${b.date}</td><td>${b.paidAt || '—'}</td><td>${format(b.amount, b.currency)}</td></tr>`,
            )
            .join(
              '',
            )}</tbody></table></div><div class="report-pagination"><button id="report-prev" ${state.page === 0 ? 'disabled' : ''}>← ${t('previousPage')}</button><span>${t('showing')} ${state.page * 50 + 1}–${Math.min((state.page + 1) * 50, report.entries.length)} / ${report.entries.length}</span><button id="report-next" ${state.page === totalPages - 1 ? 'disabled' : ''}>${t('nextPage')} →</button></div>`
        : `<p class="empty">${t('emptyReport')}</p>`
    }</section></div>`;
  const form = root.querySelector<HTMLFormElement>('#report-form')!;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = new FormData(form);
    const next = Object.fromEntries(input) as ReportOptions;
    try {
      reportFor(ledger, next);
      state.options = next;
      state.page = 0;
      redraw();
    } catch {
      root.querySelector('#range-error')!.removeAttribute('hidden');
      root.querySelector('#report-results')!.setAttribute('hidden', '');
    }
  });
  // Changing filters hides stale totals until the user applies the new range.
  form.addEventListener('input', () =>
    root.querySelector('#report-results')!.setAttribute('hidden', ''),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-period]').forEach((button) =>
    button.addEventListener('click', () => {
      const now = today(),
        period = button.dataset.period;
      (form.elements.namedItem('start') as HTMLInputElement).value =
        period === 'month'
          ? now.slice(0, 7) + '-01'
          : period === 'year'
            ? now.slice(0, 4) + '-01-01'
            : shiftMonth(now.slice(0, 7), -11) + '-01';
      (form.elements.namedItem('end') as HTMLInputElement).value = now;
      form.requestSubmit();
    }),
  );
  root
    .querySelector('#period-csv')!
    .addEventListener('click', () =>
      download(
        reportCsv(ledger, o),
        `billing-memo-${o.basis}-${o.start}-${o.end}.csv`,
        'text/csv;charset=utf-8',
      ),
    );
  root
    .querySelector('#monthly-csv')!
    .addEventListener('click', () =>
      download(
        monthlyCsv(ledger, o),
        `billing-memo-months-${o.basis}-${o.start}-${o.end}.csv`,
        'text/csv;charset=utf-8',
      ),
    );
  root.querySelector('#report-prev')?.addEventListener('click', () => {
    state.page--;
    redraw();
  });
  root.querySelector('#report-next')?.addEventListener('click', () => {
    state.page++;
    redraw();
  });
}
