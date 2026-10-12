import { blankLedger, settle, billsFor, type Ledger, type Service } from './model.ts';
/** Fictional amounts for a product walkthrough. Never provider pricing or personal billing data. */
export function sampleLedger(month: string): Ledger {
  const entries: [string, string, Service['category'], string, number, Service['kind'], number][] =
    [
      ['Cloudflare', 'https://dash.cloudflare.com/', 'cloud', 'Orbit', 800, 'monthly', 4],
      ['Supabase', 'https://supabase.com/dashboard', 'database', 'Orbit', 2900, 'monthly', 8],
      ['Resend', 'https://resend.com/', 'email', 'Orbit', 1600, 'monthly', 12],
      ['Vercel', 'https://vercel.com/dashboard', 'hosting', 'Studio', 2300, 'monthly', 16],
      ['Brave Search', 'https://api.search.brave.com/', 'api', 'Scout', 1250, 'usage', 20],
      ['AWS', 'https://console.aws.amazon.com/', 'cloud', 'Scout', 3825, 'usage', 25],
      ['Google Cloud', 'https://console.cloud.google.com/', 'cloud', 'Orbit', 2450, 'usage', 27],
      ['Domain renewal', 'https://dash.cloudflare.com/', 'tools', 'Studio', 3600, 'yearly', 28],
    ];
  const ledger = blankLedger();
  ledger.budget = 25000;
  ledger.services = entries.map(([name, url, category, project, amount, kind, day], i) => ({
    id: `demo-${i}`,
    name,
    url,
    category,
    project,
    amount,
    kind,
    currency: 'USD',
    anchor: `${month}-${String(day).padStart(2, '0')}`,
    end: '',
    paused: false,
    notes: '',
  }));
  let next = ledger;
  for (const bill of billsFor(ledger, month).slice(0, 2))
    next = settle(next, bill, bill.amount, bill.date);
  return next;
}
