const MODULE_LOAD_RECOVERY_KEY = 'tiny-tools:module-load-recovery:v1';

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

function getRecoveryStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function hasModuleLoadRecoveryAttempt(): boolean {
  const storage = getRecoveryStorage();
  if (!storage) return false;
  try {
    return storage.getItem(MODULE_LOAD_RECOVERY_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearModuleLoadRecoveryAttempt(): void {
  const storage = getRecoveryStorage();
  if (!storage) return;
  try {
    storage.removeItem(MODULE_LOAD_RECOVERY_KEY);
  } catch {
    // Storage can be blocked in hardened/private browser contexts. Recovery is
    // intentionally best-effort rather than risking a reload loop.
  }
}

export function isModuleLoadRecoveryScheduled(): boolean {
  return reloadScheduled;
}

export function attemptModuleLoadRecovery(error: unknown): boolean {
  if (!isModuleLoadError(error) || reloadScheduled) return false;

  const storage = getRecoveryStorage();
  if (!storage) return false;

  try {
    if (storage.getItem(MODULE_LOAD_RECOVERY_KEY) !== null) return false;
    storage.setItem(
      MODULE_LOAD_RECOVERY_KEY,
      JSON.stringify({ href: window.location.href, attemptedAt: Date.now() })
    );
  } catch {
    return false;
  }

  reloadScheduled = true;
  window.location.reload();
  return true;
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
