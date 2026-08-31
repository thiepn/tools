export interface QueryParamItem { id: string; key: string; value: string; }

function bytesToBinary(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + chunkSize))));
  }
  return chunks.join('');
}

export function utf8ToBase64(str: string): { result?: string; error?: string } {
  try { return { result: btoa(bytesToBinary(new TextEncoder().encode(str))) }; }
  catch (error) { return { error: error instanceof Error ? error.message : 'Failed to encode to Base64' }; }
}

function normalizeBase64(input: string): string | null {
  let cleaned = input.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!cleaned) return '';
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned) || cleaned.length % 4 === 1) return null;
  cleaned = cleaned.replace(/=+$/, '');
  return cleaned.padEnd(Math.ceil(cleaned.length / 4) * 4, '=');
}

export function base64ToUtf8(b64: string): { result?: string; error?: string } {
  try {
    const normalized = normalizeBase64(b64);
    if (normalized === null) return { error: 'Invalid Base64 or Base64URL input' };
    if (!normalized) return { result: '' };
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return { result: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch { return { error: 'Invalid Base64 or corrupted UTF-8 byte sequence' }; }
}

export function utf8ToBase64Url(str: string, includePadding = false): { result?: string; error?: string } {
  const encoded = utf8ToBase64(str);
  if (!encoded.result) return encoded;
  let result = encoded.result.replace(/\+/g, '-').replace(/\//g, '_');
  if (!includePadding) result = result.replace(/=+$/, '');
  return { result };
}

export const base64UrlToUtf8 = base64ToUtf8;

export function urlEncodeComponent(text: string): string { return encodeURIComponent(text); }
export function urlDecodeComponent(text: string): { result?: string; error?: string } {
  try { return { result: decodeURIComponent(text) }; } catch { return { error: 'Malformed percent-encoded URI component' }; }
}
export function urlEncodeFull(text: string): string { return encodeURI(text); }
export function urlDecodeFull(text: string): { result?: string; error?: string } {
  try { return { result: decodeURI(text) }; } catch { return { error: 'Malformed percent-encoded URI' }; }
}

export function parseQueryString(input: string): { baseUrl: string; params: QueryParamItem[] } {
  const trimmed = input.trim();
  if (!trimmed) return { baseUrl: '', params: [] };

  const qIndex = trimmed.indexOf('?');
  const hashIndex = trimmed.indexOf('#');
  let baseUrl = '';
  let queryString = trimmed;
  let fragment = '';

  if (qIndex >= 0) {
    const effectiveHash = hashIndex > qIndex ? hashIndex : -1;
    baseUrl = trimmed.slice(0, qIndex);
    queryString = trimmed.slice(qIndex + 1, effectiveHash >= 0 ? effectiveHash : undefined);
    if (effectiveHash >= 0) fragment = trimmed.slice(effectiveHash);
    baseUrl += fragment;
  } else if (trimmed.startsWith('?')) {
    queryString = trimmed.slice(1);
  } else if (hashIndex >= 0) {
    return { baseUrl: trimmed, params: [] };
  }

  const params: QueryParamItem[] = [];
  for (const pair of queryString.split('&')) {
    if (!pair) continue;
    const eqIndex = pair.indexOf('=');
    const rawKey = eqIndex >= 0 ? pair.slice(0, eqIndex) : pair;
    const rawValue = eqIndex >= 0 ? pair.slice(eqIndex + 1) : '';
    const decode = (value: string) => {
      try { return decodeURIComponent(value.replace(/\+/g, ' ')); } catch { return value; }
    };
    params.push({ id: `param-${params.length + 1}`, key: decode(rawKey), value: decode(rawValue) });
  }
  return { baseUrl, params };
}

export function buildQueryString(baseUrl: string, params: QueryParamItem[]): string {
  const validPairs = params.filter((param) => param.key.trim()).map((param) => `${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}`);
  const query = validPairs.join('&');
  if (!query) return baseUrl;
  if (!baseUrl) return query;

  const hashIndex = baseUrl.indexOf('#');
  const fragment = hashIndex >= 0 ? baseUrl.slice(hashIndex) : '';
  const withoutFragment = hashIndex >= 0 ? baseUrl.slice(0, hashIndex) : baseUrl;
  const separator = withoutFragment.includes('?') ? (/[?&]$/.test(withoutFragment) ? '' : '&') : '?';
  return `${withoutFragment}${separator}${query}${fragment}`;
}
