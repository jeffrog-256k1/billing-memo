import './style.css';
import './layout.css';
import './pages.css';
import './workspace.css';
import { workspaceShell, workspaceRows } from './workspace-render.ts';
import {
  desktop,
  loadWorkspace,
  saveWorkspace,
  exportNative,
  importNative,
  openNative,
} from './platform.ts';
import { mountReports, newReportState } from './reports-ui.ts';
import {
  amountInput,
  billsFor,
  blankLedger,
  categories,
  currencies,
  daysInMonth,
  digits,
  exportCsv,
  exportIcs,
  kinds,
  MAX_PAYMENTS,
  MAX_SERVICES,
  money,
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

const app = document.querySelector<HTMLDivElement>('#app')!;
const e = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const routes = ['ledger', 'calendar', 'reports'] as const;
type Route = (typeof routes)[number];
const readRoute = (): Route =>
  routes.includes(location.hash.slice(2) as Route) ? (location.hash.slice(2) as Route) : 'ledger';
let route = readRoute();
const reportState = newReportState();
const preferred = navigator.language.startsWith('zh') ? 'zh-CN' : navigator.language.slice(0, 2);
let lang: Language = languages.includes(preferred as Language) ? (preferred as Language) : 'en';
let status = '',
  saving = false,
  legacyError = false,
  migrated = false;
let month = today().slice(0, 7),
  selectedDay = '',
  search = '',
  category = '',
  project = '',
  view: 'bills' | 'services' = 'bills';
let local = blankLedger(),
  sample = sampleLedger(month),
  lastRaw: string | null = null,
  expectedRaw: string | null = null,
  storageIssue: Key | null = null,
  corrupt = false;
try {
  const savedLanguage = localStorage.getItem('billing-memo.language');
  if (languages.includes(savedLanguage as Language)) lang = savedLanguage as Language;
} catch {
  /* Language preferences are optional. */
}
try {
  const loaded = await loadWorkspace();
  lastRaw = loaded.raw;
  expectedRaw = loaded.migrated ? null : loaded.raw;
  legacyError = loaded.legacy_error;
  migrated = loaded.migrated;
  if (lastRaw) {
    try {
      local = validateLedger(JSON.parse(lastRaw));
      if (migrated) {
        const raw = JSON.stringify(local);
        await saveWorkspace(raw, null);
        lastRaw = expectedRaw = raw;
      }
    } catch {
      corrupt = true;
      storageIssue = 'corrupt';
    }
  }
} catch {
  storageIssue = 'storageError';
}
let demo = !desktop && new URLSearchParams(location.search).get('demo') === '1';
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
  if (desktop) {
    void exportNative(content, file).catch(() => toast('exportFailed'));
    return;
  }
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
async function commit(next: Ledger, replacing = false): Promise<boolean> {
  if (saving) return false;
  validateLedger(next);
  if (demo) sample = next;
  else {
    if (corrupt && !replacing) {
      toast('corrupt');
      return false;
    }
    saving = true;
    document
      .querySelectorAll<HTMLButtonElement>('dialog button')
      .forEach((b) => (b.disabled = true));
    try {
      const raw = JSON.stringify(next);
      await saveWorkspace(raw, expectedRaw);
      lastRaw = expectedRaw = raw;
      storageIssue = null;
      corrupt = false;
    } catch (error) {
      if (String(error).includes('conflict')) {
        storageIssue = 'conflict';
        saving = false;
        render();
        return false;
      }
      storageIssue = 'storageError';
    }
    saving = false;
    local = next;
  }
  render();
  return true;
}
function render() {
  document.documentElement.lang = lang;
  view = route === 'calendar' ? 'bills' : 'services';
  app.innerHTML = workspaceShell({
    ledger: data(),
    month,
    lang,
    route,
    demo,
    desktop,
    storageIssue,
    corrupt,
    search,
    category,
    project,
    status,
    saving,
    legacyError,
  });
  (document.querySelector('#language') as HTMLSelectElement).value = lang;
  renderList();
  renderCalendar();
  renderForecast();
  if (route === 'reports')
    mountReports(document.querySelector('#reports-root')!, data(), lang, reportState, download);
  wire();
}
function renderList() {
  const result = workspaceRows(data(), month, lang, route, {
    search,
    category,
    project,
    status,
    day: selectedDay,
  });
  document.querySelector('#bill-list')!.innerHTML = result.html;
  document.querySelector('#visible-count')!.textContent = String(result.count).padStart(2, '0');
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
  document.querySelector('.skip')!.addEventListener('click', (ev) => {
    ev.preventDefault();
    document.querySelector<HTMLElement>('#page-content')!.focus();
  });
  const on = (id: string, fn: () => void) =>
    document.getElementById(id)?.addEventListener('click', fn);
  on('switch-mode', () => {
    demo = !demo;
    const url = new URL(location.href);
    url.searchParams.delete('demo');
    history.replaceState(null, '', url);
    reportState.options.project = '';
    reportState.options.category = '';
    status = '';
    search = '';
    project = '';
    category = '';
    selectedDay = '';
    undoLedger = null;
    render();
  });
  on('current-month', () => goMonth(today().slice(0, 7)));
  document.querySelector('#status')!.addEventListener('change', (ev) => {
    status = (ev.target as HTMLSelectElement).value;
    renderList();
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
  on('restore', startRestore);
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
app.addEventListener('click', async (ev) => {
  const link = (ev.target as Element).closest<HTMLAnchorElement>('a[target="_blank"]');
  if (desktop && link) {
    ev.preventDefault();
    try {
      await openNative(link.href);
    } catch {
      toast('error');
    }
    return;
  }
  const button = (ev.target as Element).closest<HTMLButtonElement>('button');
  if (!button) return;
  const a = button.dataset;
  if (a.edit) openService(a.edit);
  if (a.pay) {
    const bill = billsFor(data(), month).find((b) => b.key === a.pay);
    if (bill) openPayment(bill);
  }
  if (a.action === 'add') openService();
  if (a.action === 'preferences') openPreferences();
  if (a.action === 'restore') void startRestore();
  if (a.action === 'exit-demo') {
    demo = false;
    const url = new URL(location.href);
    url.searchParams.delete('demo');
    history.replaceState(null, '', url);
    search = category = project = status = selectedDay = '';
    render();
  }
  if (a.action === 'clear-filters') {
    search = category = project = status = selectedDay = '';
    render();
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
  if (a.month) {
    goMonth(a.month);
    location.hash = '/calendar';
  }
  if (a.action === 'preferences') openPreferences();
  if (a.action === 'close') document.querySelector<HTMLDialogElement>('#dialog')!.close();
  if (a.action === 'undo' && undoLedger && undoMode === demo) {
    const prev = undoLedger;
    undoLedger = null;
    await commit(prev);
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
    `<div class="form-grid">${!old ? `<label class="field full">${e(t('preset'))}<select id="provider"><option value="">${e(t('custom'))}</option>${providerList.map(([name], i) => `<option value="${i}">${name}</option>`).join('')}</select></label>` : ''}${field('name', 'name', s.name, 'text', 'required maxlength="80"')}<label class="field">${e(t('kind'))}<select name="kind">${options(kinds, s.kind, true)}</select></label>${field('amount', 'amount', amountInput(s.amount, s.currency), 'number', `required min="0" step="${digits(s.currency) ? '0.01' : '1'}"`)}<label class="field">${e(t('currency'))}<select name="currency">${options(currencies, s.currency)}</select></label>${field('anchor', 'anchor', s.anchor, 'date', 'required min="2000-01-01" max="2199-12-31"')}<label class="field">${e(t('url'))}<input name="url" type="url" value="${e(s.url)}" maxlength="2000" placeholder="https://…"/></label><p class="hint full">${e(t('dateShortHint'))}</p><details class="form-optional full" ${old && (s.project || s.notes) ? 'open' : ''}><summary>${e(t('optionalFields'))}</summary><div class="form-grid">${field('project', 'project', s.project, 'text', 'maxlength="60"')}<label class="field">${e(t('category'))}<select name="category">${options(categories, s.category, true)}</select></label><label class="field full">${e(t('notes'))}<textarea name="notes" maxlength="2000">${e(s.notes)}</textarea></label></div></details><details class="form-optional full" ${s.end || s.paused ? 'open' : ''}><summary>${e(t('billingOptions'))}</summary><div class="form-grid">${field('end', 'end', s.end, 'date', 'min="2000-01-01" max="2199-12-31"')}<label class="check-field"><input name="paused" type="checkbox" ${s.paused ? 'checked' : ''}/>${e(t('pausedHint'))}</label></div></details></div>`,
    `${old ? `<button type="button" class="danger" id="remove-service">${e(t('delete'))}</button>` : ''}${controls()}`,
  );
  const form = dialog.querySelector<HTMLFormElement>('form')!;
  form.addEventListener(
    'invalid',
    (ev) => {
      (ev.target as HTMLElement).closest('details')?.setAttribute('open', '');
    },
    true,
  );
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
  form.addEventListener('submit', async (ev) => {
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
        await commit({
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
  dialog.querySelector('#remove-service')?.addEventListener('click', async () => {
    if (!confirm(t('deleteConfirm'))) return;
    const prior = data();
    if (await commit({ ...data(), services: data().services.filter((x) => x.id !== s.id) })) {
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
  dialog.querySelector('form')!.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      const form = ev.target as HTMLFormElement;
      const raw = new FormData(form);
      if (
        await commit(
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
  dialog.querySelector('#unpay')?.addEventListener('click', async () => {
    if (confirm(t('unpayConfirm'))) {
      const prior = data();
      if (
        await commit({ ...data(), payments: data().payments.filter((p) => p.key !== bill.key) })
      ) {
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
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      const rates: Ledger['rates'] = { [base.value]: 1 };
      for (const c of currencies.filter((c) => c !== base.value)) {
        const value = (form.elements.namedItem(`rate-${c}`) as HTMLInputElement).value;
        if (value) rates[c] = Number(value);
      }
      if (
        await commit(
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
async function startRestore() {
  if (!desktop) {
    document.querySelector<HTMLInputElement>('#import-file')!.click();
    return;
  }
  try {
    const raw = await importNative();
    if (raw === null) return;
    pendingImport = validateLedger(JSON.parse(raw));
    openRestore();
  } catch {
    toast('importError');
  }
}
function openRestore() {
  if (!pendingImport) return;
  const dialog = openDialog(
    'restoreTitle',
    `<p>${e(t('restoreHint'))}</p><p class="hint">${pendingImport.services.length} ${e(t('allServices'))} · ${pendingImport.payments.length} ${e(t('paid'))}</p><button id="backup-before" type="button">↓ ${e(t('export'))}</button>`,
    `<button type="button" data-action="close">${e(t('cancel'))}</button><button class="primary" type="submit">${e(t('restore'))}</button>`,
  );
  dialog.querySelector('#backup-before')!.addEventListener('click', backup);
  dialog.querySelector('form')!.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (pendingImport) {
      if (await commit(pendingImport, true)) {
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
window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#/')) {
    route = readRoute();
    selectedDay = '';
    render();
    document.querySelector<HTMLElement>('#page-content')!.focus();
    window.scrollTo(0, 0);
  }
});
render();
