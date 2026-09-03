export const MODULE_LOAD_RECOVERY_KEY = 'tiny-tools:module-load-recovery:v1';
export const MODULE_LOAD_RECOVERY_QUERY_PARAM = '__tiny_tools_recovery';

const MODULE_LOAD_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /failed to load module script/i,
  /unable to preload css for/i,
  /chunkloaderror/i,
  /loading (?:css )?chunk\b.*failed/i,
  /failed to fetch module/i,
];

let reloadScheduled = false;

function describeError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    const cause = 'cause' in error ? describeError(error.cause) : '';
    return [error.name, error.message, cause].filter(Boolean).join(': ');
  }
  if (error && typeof error === 'object') {
    const candidate = error as { name?: unknown; message?: unknown; cause?: unknown };
    return [candidate.name, candidate.message, candidate.cause]
      .map((value) => (typeof value === 'string' ? value : value ? describeError(value) : ''))
      .filter(Boolean)
      .join(': ');
  }
  return String(error ?? '');
}

export function isModuleLoadError(error: unknown): boolean {
  const description = describeError(error);
  return MODULE_LOAD_ERROR_PATTERNS.some((pattern) => pattern.test(description));
}

export function buildModuleLoadRecoveryUrl(
  href: string,
  token: string = Date.now().toString(36)
): string {
  const url = new URL(href);
  url.searchParams.set(MODULE_LOAD_RECOVERY_QUERY_PARAM, token);
  return url.href;
}

function hasUrlRecoveryAttempt(): boolean {
  try {
    return new URL(window.location.href).searchParams.has(MODULE_LOAD_RECOVERY_QUERY_PARAM);
  } catch {
    return false;
  }
}

function clearUrlRecoveryAttempt(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(MODULE_LOAD_RECOVERY_QUERY_PARAM)) return;
    url.searchParams.delete(MODULE_LOAD_RECOVERY_QUERY_PARAM);
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`
    );
  } catch {
    // The URL marker is only a fallback guard. If history mutation is blocked,
    // leaving it in place is safer than risking a reload loop.
  }
}

function getRecoveryStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function hasStorageRecoveryAttempt(): boolean {
  const storage = getRecoveryStorage();
  if (!storage) return false;
  try {
    return storage.getItem(MODULE_LOAD_RECOVERY_KEY) !== null;
  } catch {
    return false;
  }
}

function setStorageRecoveryAttempt(): boolean {
  const storage = getRecoveryStorage();
  if (!storage) return false;
  try {
    storage.setItem(
      MODULE_LOAD_RECOVERY_KEY,
      JSON.stringify({ href: window.location.href, attemptedAt: Date.now() })
    );
    return storage.getItem(MODULE_LOAD_RECOVERY_KEY) !== null;
  } catch {
    return false;
  }
}

function clearStorageRecoveryAttempt(): void {
  const storage = getRecoveryStorage();
  if (!storage) return;
  try {
    storage.removeItem(MODULE_LOAD_RECOVERY_KEY);
  } catch {
    // URL-based recovery remains available when storage access is blocked.
  }
}

export function hasModuleLoadRecoveryAttempt(): boolean {
  // Check the URL first because it remains available when sessionStorage is
  // blocked by private/hardened browser settings.
  return hasUrlRecoveryAttempt() || hasStorageRecoveryAttempt();
}

export function clearModuleLoadRecoveryAttempt(): void {
  clearStorageRecoveryAttempt();
  clearUrlRecoveryAttempt();
}

export function isModuleLoadRecoveryScheduled(): boolean {
  return reloadScheduled;
}

export function attemptModuleLoadRecovery(error: unknown): boolean {
  if (!isModuleLoadError(error) || reloadScheduled || hasModuleLoadRecoveryAttempt()) {
    return false;
  }

  // sessionStorage is useful as a redundant guard, but it is no longer required.
  // The URL marker survives the reload even in browsers that completely block
  // storage and also cache-busts the document URL so the latest index is fetched.
  const storageMarked = setStorageRecoveryAttempt();
  let recoveryUrl: string;
  try {
    recoveryUrl = buildModuleLoadRecoveryUrl(window.location.href);
  } catch {
    if (storageMarked) clearStorageRecoveryAttempt();
    return false;
  }

  reloadScheduled = true;
  try {
    window.location.replace(recoveryUrl);
    return true;
  } catch {
    reloadScheduled = false;
    if (storageMarked) clearStorageRecoveryAttempt();
    return false;
  }
}

export function installVitePreloadErrorRecovery(): () => void {
  const handlePreloadError = (event: Event) => {
    const payload = (event as Event & { payload?: unknown }).payload;
    if (!isModuleLoadError(payload)) return;

    if (attemptModuleLoadRecovery(payload)) {
      // Vite rethrows preload failures unless the event is canceled. The reload
      // is already scheduled, so suppress only this recoverable stale-chunk case.
      event.preventDefault();
    }
  };

  window.addEventListener('vite:preloadError', handlePreloadError);
  return () => window.removeEventListener('vite:preloadError', handlePreloadError);
}
