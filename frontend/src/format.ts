// Formatting helpers (NGN money, dates, percent).
export function nairaFromKobo(kobo: number): number {
  return Math.round((kobo || 0) / 100);
}

export function formatNaira(kobo: number, opts: { compact?: boolean } = {}): string {
  const naira = nairaFromKobo(kobo);
  if (opts.compact) {
    if (naira >= 1_000_000) return `₦${trim(naira / 1_000_000)}M`;
    if (naira >= 1_000) return `₦${trim(naira / 1_000)}K`;
    return `₦${naira.toLocaleString()}`;
  }
  return `₦${naira.toLocaleString()}`;
}

function trim(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function daysLeft(deadline?: string | null): number | null {
  if (!deadline) return null;
  const end = new Date(deadline).getTime();
  const diff = end - Date.now();
  if (isNaN(end)) return null;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const mo = Math.floor(days / 30);
  return `${mo}mo ago`;
}

export function formatAmountInput(val: string): string {
  if (!val) return "";
  const clean = val.replace(/\D/g, "");
  if (!clean) return "";
  const num = parseInt(clean, 10);
  if (isNaN(num)) return "";
  return num.toLocaleString("en-US");
}

export function parseAmountInput(val: string): number {
  if (!val) return 0;
  const clean = val.replace(/,/g, "").replace(/\D/g, "");
  return parseInt(clean, 10) || 0;
}

