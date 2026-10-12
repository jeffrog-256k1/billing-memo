import './style.css';
import './layout.css';
import {
  amountInput,
  billsFor,
  blankLedger,
  categories,
  converted,
  currencies,
  daysInMonth,
  digits,
  exportCsv,
  exportIcs,
  kinds,
  MAX_PAYMENTS,
  MAX_SERVICES,
  money,
  monthlyRunRate,
  parseAmount,
  safeUrl,
  settle,
  shiftMonth,
  STORAGE_KEY,
  today,
  totals,
  validateLedger,
  validateService,
  validMonth,
  type Bill,
  type Currency,
  type Ledger,
  type Service,
} from './model.ts';
import { languages, translate, type Key, type Language } from './i18n.ts';
import { sampleLedger } from './sample.ts';
import { drawCircuit } from './circuit.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
const e = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
let lang: Language = 'en';
let month = today().slice(0, 7),
  selectedDay = '',
  search = '',
  category = '',
  project = '',
  view: 'bills' | 'services' = 'bills';
let local = blankLedger(),
  sample = sampleLedger(month),
  lastRaw: string | null = null,
  storageIssue: Key | null = null,
  corrupt = false;
try {
  const savedLanguage = localStorage.getItem('billing-memo.language');
  if (languages.includes(savedLanguage as Language)) lang = savedLanguage as Language;
  lastRaw = localStorage.getItem(STORAGE_KEY);
  if (lastRaw) {
    try {
      local = validateLedger(JSON.parse(lastRaw));
    } catch {
      corrupt = true;
      storageIssue = 'corrupt';
    }
  }
} catch {
  storageIssue = 'storageError';
}
let demo = !lastRaw || corrupt;
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let undoLedger: Ledger | null = null,
  undoMode = false,
  pendingImport: Ledger | null = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const t = (key: Key) => translate(key, lang);
const data = () => (demo ? sample : local);
const m = (amount: number, currency = data().base) => money(amount, currency, lang);
const options = (values: readonly string[], selected: string, localize = false) =>
  values
    .map(
      (v) =>
        `<option value="${e(v)}" ${v === selected ? 'selected' : ''}>${e(localize ? t(v as Key) : v)}</option>`,
    )
    .join('');
const dateText = (date: string, short = false) =>
  new Intl.DateTimeFormat(lang, {
    month: short ? 'short' : 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date + 'T00:00:00Z'));
const monthText = (value: string) =>
  new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(value + '-01T00:00:00Z'),
  );
function download(content: string, file: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type })),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function backup() {
  download(JSON.stringify(data()), `billing-memo-${demo ? 'demo-' : ''}${today()}.json`);
}
function toast(key: Key, undo = false) {
  if (key === 'saved' && !demo && storageIssue) key = storageIssue;
  clearTimeout(toastTimer);
  const box = document.querySelector('#toast')!;
  box.innerHTML = `<span>${e(t(key))}</span>${undo ? `<button data-action="undo">${e(t('undo'))}</button>` : ''}`;
  toastTimer = setTimeout(
    () => {
      box.textContent = '';
      undoLedger = null;
    },
    undo ? 30000 : 7000,
  );
}
function commit(next: Ledger, replacing = false): boolean {
  validateLedger(next);
  if (demo) sample = next;
  else {
    if (corrupt && !replacing) {
      toast('corrupt');
      return false;
    }
    try {
      if (localStorage.getItem(STORAGE_KEY) !== lastRaw) {
        storageIssue = 'conflict';
        render();
        return false;
      }
      const raw = JSON.stringify(next);
      localStorage.setItem(STORAGE_KEY, raw);
      lastRaw = raw;
      storageIssue = null;
      corrupt = false;
    } catch {
      storageIssue = 'storageError';
    }
    local = next;
  }
  render();
  return true;
}
function stat(key: Key, result: ReturnType<typeof totals>, hint: Key) {
  return `<div class="stat"><p class="micro">${e(t(key))}</p><div class="stat-value">${result.missing.length ? '≈ ' : ''}${e(m(result.total))}</div><p class="hint">${e(t(result.missing.length ? 'partial' : hint))}</p></div>`;
}
function render() {
  document.documentElement.lang = lang;
  const ledger = data(),
    bills = billsFor(ledger, month),
    sum = totals(bills, ledger);
  app.innerHTML = `
    <a class="skip" href="#ledger">${e(t('skip'))}</a>
    <header class="topbar"><a class="brand" href="./"><img src="./favicon.svg" alt=""/>billing memo<span>BM / 001</span></a><div class="top-tools"><span class="local-badge"><i class="dot"></i>${e(t(demo ? 'demo' : 'local'))}</span><button class="quiet" id="motion" aria-pressed="${paused}" title="${e(t(paused ? 'resumeMotion' : 'pauseMotion'))}">${paused ? '▷' : 'Ⅱ'}<span class="sr-only">${e(t(paused ? 'resumeMotion' : 'pauseMotion'))}</span></button><label class="sr-only" for="language">Language</label><select id="language"><option value="en">EN · English</option><option value="ko">KO · 한국어</option><option value="zh-CN">ZH · 简体中文</option><option value="ja">JA · 日本語</option><option value="es">ES · Español</option></select></div></header>
    <main class="shell"><section class="hero"><div><p class="eyebrow">${e(t('tagline'))}</p><h1>${e(t('heroA'))}<br/>${e(t('heroB'))}</h1><p class="intro">${e(t('intro'))}</p></div><div class="hero-figure"><canvas id="circuit" aria-hidden="true"></canvas></div></section>
    <section class="mode-bar"><div><p class="mode-label">${demo ? '◌' : '●'} ${e(t(demo ? 'demo' : 'local'))}</p><p class="hint">${e(t(demo ? 'demoHint' : 'backupHint'))}</p></div><button id="switch-mode" class="accent">${e(t(demo ? 'workspace' : 'viewDemo'))} ↗</button></section>
    ${storageIssue ? `<div class="storage-error" role="alert">${e(t(storageIssue))}${corrupt ? ` <button id="raw-backup">${e(t('rawBackup'))}</button>` : ''}</div>` : ''}
    <div class="overview-head"><div class="month-picker"><button id="prev-month" aria-label="${e(t('previous'))}" ${month === '2000-01' ? 'disabled' : ''}>←</button><label class="sr-only" for="month">${e(t('month'))}</label><input id="month" type="month" value="${month}" min="2000-01" max="2199-12"/><button id="next-month" aria-label="${e(t('next'))}" ${month === '2199-12' ? 'disabled' : ''}>→</button></div><div class="page-actions"><button id="preferences">${e(t('settings'))}</button><button id="backup">↓ ${e(t('export'))}</button><button id="restore">↑ ${e(t('import'))}</button><button class="primary" id="add">+ ${e(t('add'))}</button></div></div>
    <section class="stats" aria-label="${e(t('monthTotal'))}">${stat('monthTotal', sum, 'totalHint')}${stat(
      'paid',
      totals(
        bills.filter((b) => b.paidAt),
        ledger,
      ),
      'recordedOn',
    )}${stat(
      'remaining',
      totals(
        bills.filter((b) => !b.paidAt),
        ledger,
      ),
      'estimated',
    )}${stat('runRate', monthlyRunRate(ledger, month), 'runHint')}</section>
    ${sum.missing.length ? `<div class="rate-warning">${e(t('rateMissing'))}: ${e(sum.missing.join(', '))} <button data-action="preferences">${e(t('settings'))}</button></div>` : ''}
    <div class="native-totals">${Object.entries(sum.byCurrency)
      .map(([c, v]) => `<span>${e(m(v!, c as Currency))}</span>`)
      .join(
        '',
      )}${Object.keys(sum.byCurrency).some((c) => c !== ledger.base) ? `<span>${e(t('converted'))}</span>` : ''}</div>
    <div class="workspace-grid"><section id="ledger" tabindex="-1"><header class="panel-head"><h2><span class="section-number">01 /</span>${e(t('services'))}</h2><div class="tabs"><button data-view="bills" aria-pressed="${view === 'bills'}">${e(t('monthBills'))}</button><button data-view="services" aria-pressed="${view === 'services'}">${e(t('allServices'))}</button></div></header><div class="filters"><label class="sr-only" for="search">${e(t('search'))}</label><input type="search" id="search" value="${e(search)}" placeholder="${e(t('search'))}"/><label class="sr-only" for="category">${e(t('category'))}</label><select id="category"><option value="">${e(t('allCategories'))}</option>${options(categories, category, true)}</select><label class="sr-only" for="project">${e(t('project'))}</label><select id="project"><option value="">${e(t('allProjects'))}</option>${options([...new Set([...ledger.services, ...bills].map((s) => s.project).filter(Boolean))].sort(), project)}</select></div><div id="bill-list"></div></section>
    <aside class="aside"><section><header class="panel-head"><h2><span class="section-number">02 /</span>${e(t('calendar'))}</h2></header><div class="calendar-head"><span>${e(monthText(month))}</span><span>↘ ${String(bills.length).padStart(2, '0')}</span></div><div id="calendar-grid" class="calendar-grid"></div><p class="calendar-foot">${e(t('dueHint'))}</p><button class="quiet" id="clear-day" ${!selectedDay ? 'hidden' : ''}>${e(t('clearDay'))} ×</button><div class="page-actions"><button id="csv">↓ ${e(t('exportCsv'))}</button><button id="ics">↓ ${e(t('exportIcs'))}</button></div></section>
    <section><div class="budget-box"><div class="budget-head"><h3>${e(t('budget'))}</h3><button class="quiet" data-action="preferences" aria-label="${e(t('settings'))}">↗</button></div>${ledger.budget ? `<div class="budget-value">${e(m(ledger.budget))}</div><progress class="budget-meter ${sum.total > ledger.budget ? 'over' : ''}" max="${ledger.budget}" value="${Math.min(sum.total, ledger.budget)}" aria-label="${e(t('budget'))}"></progress><p class="hint">${sum.missing.length ? e(t('partial')) : e(t(sum.total > ledger.budget ? 'budgetOver' : 'budgetLeft')) + ' · ' + e(m(Math.abs(ledger.budget - sum.total)))}</p>` : `<p class="hint">${e(t('budgetNone'))}</p><button class="quiet" data-action="preferences">+ ${e(t('budget'))}</button>`}</div><div class="distribution"><h3>${e(t('breakdown'))}</h3>${categories
      .map((cat) => {
        const value = totals(
          bills.filter((b) => b.category === cat),
          ledger,
        ).total;
        return value
          ? `<div class="break-row"><span>${e(t(cat))}</span><meter min="0" max="${Math.max(1, sum.total)}" value="${value}" aria-label="${e(t(cat))}"></meter><span>${e(m(value))}</span></div>`
          : '';
      })
      .join(
        '',
      )}${sum.missing.length ? `<p class="hint">${e(t('partial'))}</p>` : ''}</div></section></aside></div>
    <section class="outlook"><header><h2><span class="section-number">03 /</span>${e(t('forecast'))}</h2><span class="count">${ledger.services.filter((s) => !s.paused).length} ${e(t('active'))}</span></header><div class="bars" id="forecast"></div><p class="hint">${e(t('forecastHint'))}</p></section>
    <p class="storage-note">${e(t('backupHint'))}<br/>${e(t('secretsHint'))}</p>
    <footer class="footer"><span>+ BILLING MEMO / ${e(t('sheet'))}</span><div class="footer-links"><a href="https://github.com/jeffrog-256k1/billing-memo" target="_blank" rel="noopener noreferrer">${e(t('source'))} ↗</a><a href="https://github.com/jeffrog-256k1/billing-memo/blob/main/${lang === 'en' ? 'README.md' : `README.${lang}.md`}" target="_blank" rel="noopener noreferrer">${e(t('docs'))} ↗</a><span>v0.1.0 / MIT</span></div></footer></main><div id="toast" class="toast" role="status" aria-live="polite"></div><input type="file" id="import-file" accept=".json,application/json"/><dialog id="dialog" aria-labelledby="dialog-title"></dialog>`;
  (document.querySelector('#language') as HTMLSelectElement).value = lang;
  renderList();
  renderCalendar();
  renderForecast();
  drawCircuit(
    document.querySelector('#circuit')!,
    ledger.services.filter((s) => !s.paused).map((s) => s.name),
    m(sum.total),
    paused,
  );
  wire();
}
function renderList() {
  const ledger = data(),
    bills = billsFor(ledger, month);
  const rows: (Service | Bill)[] = view === 'bills' ? bills : ledger.services;
  const filtered = rows.filter(
    (row) =>
      (!category || row.category === category) &&
      (!project || row.project === project) &&
      (!selectedDay || view === 'services' || ('date' in row && row.date === selectedDay)) &&
      `${row.name} ${row.project} ${row.notes}`
        .toLocaleLowerCase(lang)
        .includes(search.toLocaleLowerCase(lang)),
  );
  document.querySelector('#bill-list')!.innerHTML =
    `<div class="list-head"><span>${e(t('service'))} / ${String(filtered.length).padStart(2, '0')}</span><span>${e(t('amount'))}</span><span>${e(t('due'))}</span><span>${e(t('actions'))}</span></div>` +
    (filtered.length
      ? filtered
          .map((row) => {
            const bill = 'date' in row ? row : bills.find((b) => b.id === row.id),
              paid = bill?.paidAt;
            const svc = ledger.services.find((s) => s.id === row.id);
            const state = paid
              ? 'paid'
              : svc?.paused
                ? 'paused'
                : bill
                  ? bill.date < today()
                    ? 'overdue'
                    : 'estimated'
                  : 'noDue';
            return `<article class="bill-row cat-${row.category}" data-row="${e(row.id)}"><div class="service-name"><span class="service-icon" aria-hidden="true">${e(row.name.slice(0, 2).toUpperCase())}</span><div><h3>${e(row.name)}</h3><p class="hint">${e(row.project || t(row.category))} · ${e(t(row.kind))}</p></div></div><div class="amount-cell">${e(m(row.amount, row.currency))}<small>${e(t('date' in row && row.paidAt ? 'actual' : row.kind === 'usage' ? 'usage' : 'amount'))}</small></div><div class="due-cell">${bill ? e(dateText(bill.date, true)) : '—'}<span class="status ${paid ? 'is-paid' : state === 'overdue' ? 'is-late' : ''}">${e(t(state))}</span></div><div class="row-actions">${bill ? `<button class="pay" data-pay="${e(bill.key)}" title="${e(t(paid ? 'editPayment' : 'record'))}">${paid ? '✓' : '+'} ${e(t(paid ? 'paid' : 'record'))}</button>` : ''}${svc ? `<button data-edit="${e(row.id)}" aria-label="${e(t('edit'))} ${e(row.name)}">${e(t('edit'))}</button>` : ''}</div>${row.url || row.notes ? `<div class="row-extra"><p>${e(row.notes)}</p>${row.url ? `<a href="${e(row.url)}" rel="noopener noreferrer" target="_blank" aria-label="${e(row.name)} · ${e(t('open'))}">${e(t('open'))} ↗</a>` : ''}</div>` : ''}</article>`;
          })
          .join('')
      : `<div class="empty">${e(t(rows.length ? 'noMatches' : 'noBills'))}</div>`);
}
function renderCalendar() {
  const bills = billsFor(data(), month),
    offset = new Date(month + '-01T00:00:00Z').getUTCDay();
  const week = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(lang, { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, 0, 4 + i)),
    ),
  );
  document.querySelector('#calendar-grid')!.innerHTML =
    week.map((d) => `<span class="weekday">${e(d)}</span>`).join('') +
    '<span></span>'.repeat(offset) +
    Array.from({ length: daysInMonth(month) }, (_, i) => {
      const date = `${month}-${String(i + 1).padStart(2, '0')}`,
        daily = bills.filter((b) => b.date === date);
      return `<button class="day ${daily.length ? 'has-bill' : ''} ${daily.length && daily.every((b) => b.paidAt) ? 'complete' : ''} ${date === selectedDay ? 'selected' : ''} ${date === today() ? 'today' : ''}" data-day="${date}" aria-pressed="${date === selectedDay}" aria-label="${e(dateText(date))}${daily.length ? ' · ' + e(daily.map((b) => `${b.name} ${m(b.amount, b.currency)}`).join(', ')) : ''}">${i + 1}</button>`;
    }).join('');
  document.querySelector('#clear-day')!.toggleAttribute('hidden', !selectedDay);
}
function renderForecast() {
  const forecast = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i))
    .filter(validMonth)
    .map((date) => ({ date, ...totals(billsFor(data(), date), data()) }));
  const max = Math.max(1, ...forecast.map((p) => p.total));
  document.querySelector('#forecast')!.innerHTML = forecast
    .map(
      (p) =>
        `<button class="forecast-bar" data-month="${p.date}"><span class="micro">${e(monthText(p.date))}</span><svg class="bar-drawing" viewBox="0 0 100 76" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="hatch-${p.date}" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="2" height="4" fill="#627a43"/><rect x="2" width="2" height="4" fill="#d2e4b5"/></pattern></defs><rect x="0" y="${76 - (p.total / max) * 76}" width="100" height="${(p.total / max) * 76}" fill="url(#hatch-${p.date})"/></svg><b>${p.missing.length ? '≈ ' : ''}${e(m(p.total))}</b>${p.missing.length ? `<span class="hint">${e(t('partial'))}</span>` : ''}</button>`,
    )
    .join('');
}
function goMonth(value: string) {
  if (validMonth(value)) {
    month = value;
    selectedDay = '';
    render();
  }
}
function wire() {
  const on = (id: string, fn: () => void) =>
    document.getElementById(id)?.addEventListener('click', fn);
  on('switch-mode', () => {
    demo = !demo;
    search = '';
    project = '';
    category = '';
    selectedDay = '';
    undoLedger = null;
    render();
  });
  on('motion', () => {
    paused = !paused;
    render();
  });
  on('prev-month', () => goMonth(shiftMonth(month, -1)));
  on('next-month', () => goMonth(shiftMonth(month, 1)));
  document
    .querySelector('#month')!
    .addEventListener('change', (ev) => goMonth((ev.target as HTMLInputElement).value));
  document.querySelector('#language')!.addEventListener('change', (ev) => {
    lang = (ev.target as HTMLSelectElement).value as Language;
    try {
      localStorage.setItem('billing-memo.language', lang);
    } catch {
      /* ledger storage reports its own errors */
    }
    render();
  });
  on('add', () => openService());
  on('preferences', openPreferences);
  on('backup', backup);
  on('raw-backup', () => download(lastRaw ?? '', `billing-memo-original-${today()}.json`));
  on('restore', () => document.querySelector<HTMLInputElement>('#import-file')!.click());
  on('csv', () =>
    download(
      exportCsv(billsFor(data(), month)),
      `billing-memo-${month}.csv`,
      'text/csv;charset=utf-8',
    ),
  );
  on('ics', () =>
    download(
      exportIcs(billsFor(data(), month)),
      `billing-memo-${month}.ics`,
      'text/calendar;charset=utf-8',
    ),
  );
  on('clear-day', () => {
    selectedDay = '';
    renderList();
    renderCalendar();
  });
  document.querySelector('#search')!.addEventListener('input', (ev) => {
    search = (ev.target as HTMLInputElement).value;
    renderList();
  });
  for (const id of ['category', 'project'])
    document.getElementById(id)!.addEventListener('change', (ev) => {
      const value = (ev.target as HTMLSelectElement).value;
      if (id === 'category') category = value;
      else project = value;
      renderList();
    });
  document.querySelector('#import-file')!.addEventListener('change', async (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('size');
      pendingImport = validateLedger(JSON.parse(await file.text()));
      openRestore();
    } catch {
      toast('importError');
    }
    (ev.target as HTMLInputElement).value = '';
  });
}
app.addEventListener('click', (ev) => {
  const button = (ev.target as Element).closest<HTMLButtonElement>('button');
  if (!button) return;
  const a = button.dataset;
  if (a.edit) openService(a.edit);
  if (a.pay) {
    const bill = billsFor(data(), month).find((b) => b.key === a.pay);
    if (bill) openPayment(bill);
  }
  if (a.view) {
    view = a.view as typeof view;
    selectedDay = '';
    render();
  }
  if (a.day) {
    selectedDay = selectedDay === a.day ? '' : a.day;
    view = 'bills';
    render();
  }
  if (a.month) goMonth(a.month);
  if (a.action === 'preferences') openPreferences();
  if (a.action === 'close') document.querySelector<HTMLDialogElement>('#dialog')!.close();
  if (a.action === 'undo' && undoLedger && undoMode === demo) {
    const prev = undoLedger;
    undoLedger = null;
    commit(prev);
    toast('saved');
  }
});
function openDialog(title: Key, body: string, footer: string) {
  const dialog = document.querySelector<HTMLDialogElement>('#dialog')!;
  dialog.innerHTML = `<form id="modal-form"><header><h2 id="dialog-title">${e(t(title))}</h2><button type="button" class="quiet" data-action="close" aria-label="${e(t('close'))}">×</button></header><div class="body"><p class="form-error" id="form-error" role="alert" hidden></p>${body}</div><footer>${footer}</footer></form>`;
  dialog.showModal();
  return dialog;
}
const controls = () =>
  `<button type="button" data-action="close">${e(t('cancel'))}</button><button type="submit" class="primary">${e(t('save'))}</button>`;
const field = (name: string, label: Key, value: string, type = 'text', extra = '') =>
  `<label class="field">${e(t(label))}<input name="${name}" value="${e(value)}" type="${type}" ${extra}/></label>`;
function formError(key: Key = 'error') {
  const el = document.querySelector('#form-error')!;
  el.textContent = t(key);
  el.removeAttribute('hidden');
}
const providerList: [string, string, Service['category']][] = [
  ['AWS', 'https://console.aws.amazon.com/', 'cloud'],
  ['Cloudflare', 'https://dash.cloudflare.com/', 'cloud'],
  ['Google Cloud', 'https://console.cloud.google.com/', 'cloud'],
  ['Resend', 'https://resend.com/', 'email'],
  ['Vercel', 'https://vercel.com/dashboard', 'hosting'],
  ['Supabase', 'https://supabase.com/dashboard', 'database'],
  ['Brave Search', 'https://api.search.brave.com/', 'api'],
];
function openService(id?: string) {
  const old = data().services.find((s) => s.id === id);
  if (!old && data().services.length >= MAX_SERVICES) {
    toast('limit');
    return;
  }
  const s: Service = old ?? {
    id: crypto.randomUUID(),
    name: '',
    url: '',
    category: 'cloud',
    project: '',
    amount: 0,
    currency: data().base,
    kind: 'monthly',
    anchor: today(),
    end: '',
    paused: false,
    notes: '',
  };
  const dialog = openDialog(
    old ? 'edit' : 'add',
    `<div class="form-grid">${!old ? `<label class="field full">${e(t('preset'))}<select id="provider"><option value="">${e(t('custom'))}</option>${providerList.map(([name], i) => `<option value="${i}">${name}</option>`).join('')}</select></label>` : ''}${field('name', 'name', s.name, 'text', 'required maxlength="80"')}${field('project', 'project', s.project, 'text', 'maxlength="60"')}<label class="field">${e(t('category'))}<select name="category">${options(categories, s.category, true)}</select></label><label class="field">${e(t('kind'))}<select name="kind">${options(kinds, s.kind, true)}</select></label>${field('amount', 'amount', amountInput(s.amount, s.currency), 'number', `required min="0" step="${digits(s.currency) ? '0.01' : '1'}"`)}<label class="field">${e(t('currency'))}<select name="currency">${options(currencies, s.currency)}</select></label>${field('anchor', 'anchor', s.anchor, 'date', 'required min="2000-01-01" max="2199-12-31"')}${field('end', 'end', s.end, 'date', 'min="2000-01-01" max="2199-12-31"')}<p class="hint full">${e(t('dateHint'))}</p><label class="field full">${e(t('url'))}<input name="url" type="url" value="${e(s.url)}" maxlength="2000" placeholder="https://…"/></label><label class="field full">${e(t('notes'))}<textarea name="notes" maxlength="2000">${e(s.notes)}</textarea></label><label class="check-field full"><input name="paused" type="checkbox" ${s.paused ? 'checked' : ''}/>${e(t('pausedHint'))}</label></div>`,
    `${old ? `<button type="button" class="danger" id="remove-service">${e(t('delete'))}</button>` : ''}${controls()}`,
  );
  const form = dialog.querySelector<HTMLFormElement>('form')!;
  const input = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
  dialog.querySelector('#provider')?.addEventListener('change', (ev) => {
    const v = (ev.target as HTMLSelectElement).value;
    if (v !== '') {
      const [name, url, cat] = providerList[Number(v)];
      input('name').value = name;
      input('url').value = url;
      input('category').value = cat;
    }
  });
  input('currency').addEventListener('change', () => {
    input('amount').step = digits(input('currency').value as Currency) ? '0.01' : '1';
  });
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    try {
      const currency = input('currency').value as Currency;
      const service = validateService({
        ...s,
        name: input('name').value,
        project: input('project').value,
        category: input('category').value,
        kind: input('kind').value,
        currency,
        amount: parseAmount(input('amount').value, currency),
        anchor: input('anchor').value,
        end: input('end').value,
        url: safeUrl(input('url').value),
        notes: input('notes').value,
        paused: input('paused').checked,
      });
      if (
        commit({
          ...data(),
          services: old
            ? data().services.map((x) => (x.id === s.id ? service : x))
            : [...data().services, service],
        })
      )
        toast('saved');
    } catch {
      formError();
    }
  });
  dialog.querySelector('#remove-service')?.addEventListener('click', () => {
    if (!confirm(t('deleteConfirm'))) return;
    const prior = data();
    if (commit({ ...data(), services: data().services.filter((x) => x.id !== s.id) })) {
      undoLedger = prior;
      undoMode = demo;
      toast('removed', true);
    }
  });
}
function openPayment(bill: Bill) {
  if (!bill.paidAt && data().payments.length >= MAX_PAYMENTS) {
    toast('limit');
    return;
  }
  const dialog = openDialog(
    bill.paidAt ? 'editPayment' : 'record',
    `<p><strong>${e(bill.name)}</strong> · ${e(dateText(bill.date))} · ${bill.currency}</p><p class="hint">${e(t('paymentHint'))}</p><div class="form-grid">${field('actual', 'actual', amountInput(bill.amount, bill.currency), 'number', `required min="0" step="${digits(bill.currency) ? '0.01' : '1'}"`)}${field('paidAt', 'recordedOn', bill.paidAt || today(), 'date', 'required min="2000-01-01" max="2199-12-31"')}</div>`,
    `${bill.paidAt ? `<button type="button" class="danger" id="unpay">${e(t('unpay'))}</button>` : ''}${controls()}`,
  );
  dialog.querySelector('form')!.addEventListener('submit', (ev) => {
    ev.preventDefault();
    try {
      const form = ev.target as HTMLFormElement;
      const raw = new FormData(form);
      if (
        commit(
          settle(
            data(),
            bill,
            parseAmount(String(raw.get('actual')), bill.currency),
            String(raw.get('paidAt')),
          ),
        )
      )
        toast('saved');
    } catch {
      formError();
    }
  });
  dialog.querySelector('#unpay')?.addEventListener('click', () => {
    if (confirm(t('unpayConfirm'))) {
      const prior = data();
      if (commit({ ...data(), payments: data().payments.filter((p) => p.key !== bill.key) })) {
        undoLedger = prior;
        undoMode = demo;
        toast('saved', true);
      }
    }
  });
}
function openPreferences() {
  const ledger = data();
  const dialog = openDialog(
    'settings',
    `<div class="form-grid"><label class="field">${e(t('base'))}<select name="base">${options(currencies, ledger.base)}</select></label>${field('budget', 'budget', amountInput(ledger.budget, ledger.base), 'number', `required min="0" step="${digits(ledger.base) ? '0.01' : '1'}"`)}</div><p class="hint">${e(t('rateHint'))}</p><h3>${e(t('rates'))}</h3><div class="rate-grid" id="rates"></div>`,
    controls(),
  );
  const form = dialog.querySelector<HTMLFormElement>('form')!,
    base = form.elements.namedItem('base') as HTMLSelectElement,
    budget = form.elements.namedItem('budget') as HTMLInputElement;
  const draw = () => {
    document.querySelector('#rates')!.innerHTML = currencies
      .filter((c) => c !== base.value)
      .map(
        (c) =>
          `<label>1 ${c} = <input name="rate-${c}" type="number" min="0.000000001" max="1000000" step="any" value="${base.value === ledger.base ? e(ledger.rates[c] ?? '') : ''}" aria-label="${c} → ${base.value}"/> ${base.value}</label>`,
      )
      .join('');
  };
  draw();
  base.addEventListener('change', () => {
    budget.value = '0';
    budget.step = digits(base.value as Currency) ? '0.01' : '1';
    draw();
  });
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    try {
      const rates: Ledger['rates'] = { [base.value]: 1 };
      for (const c of currencies.filter((c) => c !== base.value)) {
        const value = (form.elements.namedItem(`rate-${c}`) as HTMLInputElement).value;
        if (value) rates[c] = Number(value);
      }
      if (
        commit(
          validateLedger({
            ...ledger,
            base: base.value,
            rates,
            budget: parseAmount(budget.value, base.value as Currency),
          }),
        )
      )
        toast('saved');
    } catch {
      formError();
    }
  });
}
function openRestore() {
  if (!pendingImport) return;
  const dialog = openDialog(
    'restoreTitle',
    `<p>${e(t('restoreHint'))}</p><p class="hint">${pendingImport.services.length} ${e(t('allServices'))} · ${pendingImport.payments.length} ${e(t('paid'))}</p><button id="backup-before" type="button">↓ ${e(t('export'))}</button>`,
    `<button type="button" data-action="close">${e(t('cancel'))}</button><button class="primary" type="submit">${e(t('restore'))}</button>`,
  );
  dialog.querySelector('#backup-before')!.addEventListener('click', backup);
  dialog.querySelector('form')!.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (pendingImport) {
      if (commit(pendingImport, true)) {
        pendingImport = null;
        toast('saved');
      }
    }
  });
}
window.addEventListener('storage', (ev) => {
  if (ev.key === STORAGE_KEY && ev.newValue !== lastRaw) {
    storageIssue = 'conflict';
    if (!demo) render();
  }
});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (ev) => {
  paused = ev.matches;
  render();
});
render();
