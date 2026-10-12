import {
  categories,
  billsFor,
  monthlyRunRate,
  totals,
  money,
  today,
  type Currency,
  type Ledger,
  type Service,
  type Bill,
} from './model.ts';
import { translate, type Key, type Language } from './i18n.ts';
export const escape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
type View = {
  ledger: Ledger;
  month: string;
  lang: Language;
  route: string;
  demo: boolean;
  desktop: boolean;
  storageIssue: Key | null;
  corrupt: boolean;
  search: string;
  category: string;
  project: string;
  status: string;
  saving: boolean;
  legacyError: boolean;
};
export function workspaceShell(v: View) {
  const { ledger, month, lang, route, demo, desktop } = v,
    e = escape,
    t = (k: Key) => e(translate(k, lang)),
    m = (amount: number, c = ledger.base) => e(money(amount, c, lang));
  const bills = billsFor(ledger, month),
    sum = totals(bills, ledger),
    paid = totals(
      bills.filter((b) => b.paidAt),
      ledger,
    ),
    unpaid = totals(
      bills.filter((b) => !b.paidAt),
      ledger,
    );
  const recurring = monthlyRunRate(ledger, month);
  const next = bills.filter((b) => !b.paidAt && b.date >= today())[0];
  const nav = [
    ['ledger', 'ledgerPage'],
    ['calendar', 'calendarPage'],
    ['reports', 'reports'],
  ] as const;
  const opt = (values: readonly string[], selected: string, localized = false) =>
    values
      .map(
        (value) =>
          `<option value="${e(value)}" ${selected === value ? 'selected' : ''}>${localized ? t(value as Key) : e(value)}</option>`,
      )
      .join('');
  const stat = (label: Key, value: ReturnType<typeof totals>, hint: Key, id: string) =>
    `<article class="summary-card ${id === 'month-total' ? 'summary-primary' : ''}"><p class="micro">${t(label)}</p><strong class="stat-value" id="${id}">${value.missing.length ? '≈ ' : ''}${m(value.total)}</strong><p class="hint">${t(value.missing.length ? 'partial' : hint)}</p></article>`;
  return `<a class="skip" href="#page-content">${t('skip')}</a><aside class="app-sidebar"><a class="brand" href="#/ledger"><img src="./favicon.svg" alt=""/>billing memo</a><span class="sidebar-caption">THE PERSONAL LEDGER</span><nav class="page-nav" aria-label="${t('navigation')}">${nav.map(([id, key], i) => `<a href="#/${id}" ${route === id ? 'aria-current="page"' : ''}><span>0${i + 1}</span>${t(key)}</a>`).join('')}</nav><div class="sidebar-bottom"><button id="preferences" class="sidebar-setting">${t('settings')} <span>↗</span></button><label class="sr-only" for="language">Language</label><select id="language"><option value="en">English</option><option value="ko">한국어</option><option value="zh-CN">简体中文</option><option value="ja">日本語</option><option value="es">Español</option></select><p class="device-status"><i class="dot"></i>${t(demo ? 'demoSmall' : v.saving ? 'saving' : v.storageIssue ? 'storageError' : desktop ? 'desktopLocal' : 'local')}</p><small>v0.3.0 · LOCAL FIRST</small></div></aside>
 <main class="app-main" id="page-content" tabindex="-1"><header class="workspace-header"><div><p class="eyebrow">${route === 'reports' ? 'ANALYTICS' : route === 'calendar' ? 'PAYMENT SCHEDULE' : 'YOUR WORKSPACE'}</p><h1>${t(route === 'reports' ? 'reports' : route === 'calendar' ? 'calendarPage' : 'ledgerPage')}</h1><p class="page-description">${t(route === 'ledger' ? 'ledgerSubtitle' : route === 'calendar' ? 'dueHint' : 'periodHint')}</p></div><div class="header-actions"><details id="tools-menu" class="tools-menu"><summary aria-label="${t('moreTools')}">··· <span>${t('moreTools')}</span></summary><div class="tools-popover"><button id="backup">↓ ${t('export')}</button><button id="restore">↑ ${t('import')}</button>${!desktop ? `<button id="switch-mode">${t(demo ? 'workspace' : 'viewDemo')}</button><a href="https://github.com/jeffrog-256k1/billing-memo/releases/latest" target="_blank" rel="noopener noreferrer">${t('desktopDownload')} ↗</a>` : ''}<a href="https://github.com/jeffrog-256k1/billing-memo/blob/main/${lang === 'en' ? 'README.md' : `README.${lang}.md`}" target="_blank" rel="noopener noreferrer">${t('docs')} ↗</a></div></details><button id="add" class="primary">+ ${t('add')}</button></div></header>
 ${demo ? `<div class="demo-ribbon"><span>${t('demoSmall')}</span><button data-action="exit-demo">${t('demoExit')} →</button></div>` : ''}
 ${v.legacyError ? `<div class="storage-error" role="alert">${t('legacyError')}</div>` : ''}
 ${v.storageIssue ? `<div class="storage-error" role="alert">${t(v.storageIssue)}${v.corrupt ? ` <button id="raw-backup">${t('rawBackup')}</button>` : ''}</div>` : ''}
 <section class="month-overview" ${route === 'reports' ? 'hidden' : ''}><div class="month-toolbar"><div class="month-picker"><button id="prev-month" aria-label="${t('previous')}" ${month === '2000-01' ? 'disabled' : ''}>←</button><label class="sr-only" for="month">${t('month')}</label><input id="month" type="month" value="${month}" min="2000-01" max="2199-12"/><button id="next-month" aria-label="${t('next')}" ${month === '2199-12' ? 'disabled' : ''}>→</button><button id="current-month" class="quiet">${t('thisMonth')}</button></div><span class="service-count">${ledger.services.length} ${t('expenseCount')} <span>·</span> ${ledger.base}</span></div><div class="summary-grid">${stat('monthlyCharge', sum, 'totalHint', 'month-total')}${stat('paid', paid, 'paidMonthHint', 'paid-total')}${stat('remaining', unpaid, 'estimated', 'unpaid-total')}</div>${sum.missing.length ? `<div class="rate-warning">${t('rateMissing')}: ${e(sum.missing.join(', '))} <button data-action="preferences">${t('settings')}</button></div>` : ''}<div class="summary-foot"><div class="native-totals">${Object.entries(
   sum.byCurrency,
 )
   .map(([c, n]) => `<span>${m(n!, c as Currency)}</span>`)
   .join(
     '',
   )}</div><p>${next ? `${t('dueNext')}: <strong>${e(next.name)}</strong> · ${next.date}` : t(ledger.services.length ? 'noUpcoming' : 'emptyMoney')}</p></div>${ledger.budget > 0 ? `<p class="budget-line">${t('budget')}: ${m(ledger.budget)} · ${sum.missing.length ? t('partial') : t(sum.total > ledger.budget ? 'budgetOver' : 'budgetLeft') + ': ' + m(Math.abs(ledger.budget - sum.total))}</p>` : ''}</section>
 <div class="ledger-layout ${route === 'calendar' ? 'with-calendar' : ''}" ${route === 'reports' ? 'hidden' : ''}><section class="ledger-panel" id="ledger"><div class="ledger-heading"><h2>${t(route === 'calendar' ? 'monthBills' : 'allServices')}</h2><span class="ledger-count" id="visible-count"></span></div><div class="filters" ${!ledger.services.length && !bills.length ? 'hidden' : ''}><label class="sr-only" for="search">${t('search')}</label><input type="search" id="search" value="${e(v.search)}" placeholder="${t('search')}"/><label class="sr-only" for="status">${t('statusFilter')}</label><select id="status"><option value="">${t('allStatus')}</option>${opt(['paid', 'unpaid', 'paused'], v.status, true)}</select><details class="advanced-filters"><summary>${t('category')} / ${t('project')}</summary><div><label>${t('category')}<select id="category"><option value="">${t('allCategories')}</option>${opt(categories, v.category, true)}</select></label><label>${t('project')}<select id="project"><option value="">${t('allProjects')}</option>${opt([...new Set([...ledger.services, ...bills].map((s) => s.project).filter(Boolean))].sort(), v.project)}</select></label></div></details></div><div id="bill-list"></div>${ledger.services.length || bills.length ? `<p class="ledger-help">${t('manageHint')}</p>` : ''}</section>
 <aside class="calendar-panel" ${route !== 'calendar' ? 'hidden' : ''}><header class="panel-head"><h2>${t('calendar')}</h2></header><div id="calendar-grid" class="calendar-grid"></div><button class="quiet" id="clear-day" hidden>${t('clearDay')} ×</button><div class="page-actions"><button id="csv">↓ CSV</button><button id="ics">↓ ICS</button></div></aside></div>
 <details class="outlook" ${route !== 'ledger' || !ledger.services.length ? 'hidden' : ''}><summary>${t('moreInsights')} <span>↗</span></summary><p class="hint">${t('runRate')}: ${recurring.missing.length ? t('partial') + ' · ' : ''}${m(recurring.total)}</p><div class="bars" id="forecast"></div><p class="hint">${t('forecastHint')}</p></details>
 <section id="reports-root" ${route !== 'reports' ? 'hidden' : ''}></section><footer class="workspace-footer"><span>${t('quickStart')}</span><span>billing memo / 0.3.0</span></footer></main><div id="toast" class="toast" role="status" aria-live="polite"></div><input type="file" id="import-file" accept=".json,application/json"/><dialog id="dialog" aria-labelledby="dialog-title"></dialog>`;
}
export function workspaceRows(
  ledger: Ledger,
  month: string,
  lang: Language,
  route: string,
  filter: { search: string; category: string; project: string; status: string; day: string },
) {
  const e = escape,
    t = (k: Key) => e(translate(k, lang)),
    m = (n: number, c: Currency) => e(money(n, c, lang));
  const bills = billsFor(ledger, month);
  const rows: (Service | Bill)[] =
    route === 'calendar'
      ? bills
      : [...ledger.services, ...bills.filter((b) => !ledger.services.some((s) => s.id === b.id))];
  const billOf = (row: Service | Bill) =>
    'date' in row ? row : bills.find((b) => b.id === row.id);
  const filtered = rows.filter((row) => {
    const bill = billOf(row),
      paused = 'paused' in row && row.paused;
    return (
      (!filter.category || row.category === filter.category) &&
      (!filter.project || row.project === filter.project) &&
      (!filter.day || bill?.date === filter.day) &&
      `${row.name} ${row.project} ${row.notes}`
        .toLocaleLowerCase(lang)
        .includes(filter.search.toLocaleLowerCase(lang)) &&
      (!filter.status ||
        (filter.status === 'paid'
          ? !!bill?.paidAt
          : filter.status === 'unpaid'
            ? !!bill && !bill.paidAt
            : paused))
    );
  });
  if (!rows.length)
    return {
      count: 0,
      html: `<div class="welcome-empty"><div class="empty-symbol" aria-hidden="true">+</div><p class="micro">A CLEAN SLATE</p><h2>${t('emptyTitle')}</h2><p>${t('emptyHint')}</p><button class="primary" data-action="add">+ ${t('firstService')}</button><button class="quiet" data-action="restore">${t('import')}</button></div>`,
    };
  if (!filtered.length)
    return {
      count: 0,
      html: `<div class="empty"><p>${t('noMatches')}</p><button data-action="clear-filters">${t('clearFilters')}</button></div>`,
    };
  return {
    count: filtered.length,
    html:
      `<div class="list-head"><span>${t('service')}</span><span>${t('plannedAmount')}</span><span>${t('monthCharge')}</span><span>${t('due')}</span><span>${t('actions')}</span></div>` +
      filtered
        .map((row) => {
          const bill = billOf(row),
            svc = ledger.services.find((s) => s.id === row.id);
          const status = bill?.paidAt
            ? 'paid'
            : svc?.paused
              ? 'paused'
              : bill
                ? bill.date < today()
                  ? 'overdue'
                  : 'unpaid'
                : 'noDueThisMonth';
          return `<article class="bill-row" data-row="${e(row.id)}"><div class="service-name"><span class="service-icon" aria-hidden="true">${e(row.name.slice(0, 2).toUpperCase())}</span><div><h3>${e(row.name)}</h3><p class="hint">${t(row.kind)}${row.project ? ' · ' + e(row.project) : ''}</p></div></div><div class="plan-cell"><span class="mobile-cell-label">${t('plannedAmount')}</span>${m(row.amount, row.currency)}</div><div class="amount-cell"><span class="mobile-cell-label">${t('monthCharge')}</span>${bill ? m(bill.amount, bill.currency) : '—'}<small>${t(bill?.paidAt ? 'actual' : bill ? 'estimated' : 'noDueThisMonth')}</small></div><div class="due-cell">${bill ? e(new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(bill.date + 'T00:00:00Z'))) : '—'}<span class="status ${bill?.paidAt ? 'is-paid' : status === 'overdue' ? 'is-late' : ''}">${t(status)}</span></div><div class="row-actions">${bill ? `<button class="pay" data-pay="${e(bill.key)}">${bill.paidAt ? '✓ ' : ''}${t(bill.paidAt ? 'paid' : 'record')}</button>` : ''}${svc ? `<button data-edit="${e(row.id)}" aria-label="${t('edit')} ${e(row.name)}">${t('edit')}</button>` : ''}${row.url ? `<a class="service-link" href="${e(row.url)}" target="_blank" rel="noopener noreferrer" aria-label="${t('open')} ${e(row.name)}">↗</a>` : ''}</div>${row.notes ? `<details class="row-note"><summary>${t('notes')}</summary><p>${e(row.notes)}</p></details>` : ''}</article>`;
        })
        .join(''),
  };
}
