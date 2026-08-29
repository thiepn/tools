export interface QueryParamItem {
  id: string;
  key: string;
  value: string;
}

// Robust UTF-8 Base64 Encoding
export function utf8ToBase64(str: string): { result?: string; error?: string } {
  try {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return { result: btoa(binary) };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to encode to Base64' };
  }
}

// Robust UTF-8 Base64 Decoding
export function base64ToUtf8(b64: string): { result?: string; error?: string } {
  try {
    const cleaned = b64.trim().replace(/\s+/g, '');
    if (!cleaned) return { result: '' };

    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { result: decoded };
  } catch (err: unknown) {
    return { error: 'Invalid Base64 or corrupted UTF-8 byte sequence' };
  }
}

// URL Encode / Decode operations
export function urlEncodeComponent(text: string): string {
  return encodeURIComponent(text);
}

export function urlDecodeComponent(text: string): { result?: string; error?: string } {
  try {
    return { result: decodeURIComponent(text) };
  } catch (err: unknown) {
    return { error: 'Malformed percent-encoded URI component' };
  }
}

export function urlEncodeFull(text: string): string {
  return encodeURI(text);
}

export function urlDecodeFull(text: string): { result?: string; error?: string } {
  try {
    return { result: decodeURI(text) };
  } catch (err: unknown) {
    return { error: 'Malformed percent-encoded URI' };
  }
}

// Parse URL / Query String into base URL and parameter list
export function parseQueryString(input: string): { baseUrl: string; params: QueryParamItem[] } {
  if (!input.trim()) return { baseUrl: '', params: [] };

  let baseUrl = '';
  let queryString = input.trim();

  // If input contains ?, split into base URL and query string
  const qIndex = input.indexOf('?');
  const hashIndex = input.indexOf('#');

  if (qIndex !== -1) {
    baseUrl = input.slice(0, qIndex);
    queryString = hashIndex !== -1 && hashIndex > qIndex 
      ? input.slice(qIndex + 1, hashIndex) 
      : input.slice(qIndex + 1);
  } else if (queryString.startsWith('?')) {
    queryString = queryString.slice(1);
  }

  const params: QueryParamItem[] = [];
  if (!queryString) return { baseUrl, params };

  const pairs = queryString.split('&');
  let idCounter = 1;

  for (const pair of pairs) {
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    let rawKey = '';
    let rawVal = '';

    if (eqIdx !== -1) {
      rawKey = pair.slice(0, eqIdx);
      rawVal = pair.slice(eqIdx + 1);
    } else {
      rawKey = pair;
      rawVal = '';
    }

    let decodedKey = rawKey;
    let decodedVal = rawVal;
    try {
      decodedKey = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    } catch {
      // keep raw if decode fails
    }
    try {
      decodedVal = decodeURIComponent(rawVal.replace(/\+/g, ' '));
    } catch {
      // keep raw if decode fails
    }

    params.push({
      id: `param-${idCounter++}-${Date.now()}`,
      key: decodedKey,
      value: decodedVal,
    });
  }

  return { baseUrl, params };
}

// Build query string from parameters
export function buildQueryString(baseUrl: string, params: QueryParamItem[]): string {
  const validPairs = params
    .filter((p) => p.key.trim().length > 0)
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`);

  const qs = validPairs.join('&');
  if (!qs) return baseUrl;
  if (!baseUrl) return qs;

  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${qs}`;
}
