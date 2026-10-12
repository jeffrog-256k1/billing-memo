export const APP_URL = 'billing-memo://app/';
export function internalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'billing-memo:' && url.host === 'app' && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function externalUrl(value) {
  try {
    const url = new URL(value);
    return value.length <= 2000 && url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function assetKey(value) {
  if (!internalUrl(value)) return null;
  const pathname = new URL(value).pathname;
  if (pathname === '/' || pathname === '/index.html') return 'index.html';
  // Bundled Vite assets only; no arbitrary file, percent-encoded path or directory access.
  return /^\/(?:favicon\.svg|assets\/[a-zA-Z0-9_-]+\.(?:js|css))$/.test(pathname)
    ? pathname.slice(1)
    : null;
}
export const contentSecurityPolicy =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
