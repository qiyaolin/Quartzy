const RELOAD_KEY_PREFIX = 'force_reload_once_';

export interface VersionCheckOptions {
  manifestPath?: string;
  fetchImpl?: typeof fetch;
  reloadImpl?: () => void;
  now?: () => number;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  currentMainJs?: string | null;
}

export interface VersionEnforcerOptions {
  intervalMs?: number;
  manifestPath?: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const readManifestMainJs = (payload: unknown): string | null => {
  if (!isObject(payload) || !isObject(payload.files)) {
    return null;
  }
  const mainJs = payload.files['main.js'];
  return typeof mainJs === 'string' ? mainJs : null;
};

export const extractMainJsFileName = (value: string | null | undefined): string | null => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  try {
    const url = value.startsWith('http')
      ? new URL(value)
      : new URL(value, window.location.origin);
    const filename = url.pathname.split('/').pop() || '';
    return filename || null;
  } catch {
    const normalized = value.split('?')[0].split('#')[0];
    const filename = normalized.split('/').pop() || '';
    return filename || null;
  }
};

export const getCurrentMainJsFileName = (): string | null => {
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  const mainScript = scripts
    .map(script => script.getAttribute('src') || '')
    .find(src => /\/static\/js\/main\..+\.js(?:[?#].*)?$/.test(src));

  return extractMainJsFileName(mainScript || null);
};

const buildCacheBustedManifestUrl = (manifestPath: string, now: () => number): string => {
  const separator = manifestPath.includes('?') ? '&' : '?';
  return `${manifestPath}${separator}ts=${now()}`;
};

export const checkForNewVersionOnce = async (options: VersionCheckOptions = {}): Promise<boolean> => {
  const manifestPath = options.manifestPath || '/asset-manifest.json';
  const fetchImpl = options.fetchImpl || fetch;
  const reloadImpl = options.reloadImpl || (() => window.location.reload());
  const now = options.now || (() => Date.now());
  const storage = options.storage || window.sessionStorage;
  const currentMain = options.currentMainJs ?? getCurrentMainJsFileName();

  if (!currentMain) {
    return false;
  }

  try {
    const response = await fetchImpl(buildCacheBustedManifestUrl(manifestPath, now), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    const manifestMainJs = readManifestMainJs(payload);
    const manifestMainFile = extractMainJsFileName(manifestMainJs);

    if (!manifestMainFile || manifestMainFile === currentMain) {
      return false;
    }

    const reloadKey = `${RELOAD_KEY_PREFIX}${manifestMainFile}`;
    if (storage.getItem(reloadKey) === '1') {
      return false;
    }

    storage.setItem(reloadKey, '1');
    reloadImpl();
    return true;
  } catch {
    return false;
  }
};

export const startVersionEnforcer = (options: VersionEnforcerOptions = {}): (() => void) => {
  if (process.env.NODE_ENV !== 'production') {
    return () => undefined;
  }

  const intervalMs = options.intervalMs ?? 60_000;
  const manifestPath = options.manifestPath || '/asset-manifest.json';
  let disposed = false;

  const runCheck = () => {
    if (disposed) {
      return;
    }
    void checkForNewVersionOnce({ manifestPath });
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      runCheck();
    }
  };

  window.addEventListener('focus', runCheck);
  document.addEventListener('visibilitychange', onVisibilityChange);
  const timerId = window.setInterval(runCheck, intervalMs);

  runCheck();

  return () => {
    disposed = true;
    window.clearInterval(timerId);
    window.removeEventListener('focus', runCheck);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
};
