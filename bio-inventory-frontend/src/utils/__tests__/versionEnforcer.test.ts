import {
  checkForNewVersionOnce,
  extractMainJsFileName,
  startVersionEnforcer
} from '../versionEnforcer';

const createStorageMock = () => {
  const data = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => data.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      data.set(key, value);
    })
  };
};

describe('extractMainJsFileName', () => {
  test('extracts filename from absolute and relative paths', () => {
    expect(extractMainJsFileName('/static/js/main.abc123.js')).toBe('main.abc123.js');
    expect(extractMainJsFileName('https://inventory.hayerlab.org/static/js/main.xyz987.js')).toBe('main.xyz987.js');
  });

  test('returns null for invalid values', () => {
    expect(extractMainJsFileName('')).toBeNull();
    expect(extractMainJsFileName(null)).toBeNull();
    expect(extractMainJsFileName(undefined)).toBeNull();
  });
});

describe('checkForNewVersionOnce', () => {
  test('does not reload when manifest has the same main bundle', async () => {
    const storage = createStorageMock();
    const reloadSpy = jest.fn();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ files: { 'main.js': '/static/js/main.samehash.js' } })
    });

    const updated = await checkForNewVersionOnce({
      currentMainJs: 'main.samehash.js',
      fetchImpl: fetchMock as any,
      reloadImpl: reloadSpy,
      storage
    });

    expect(updated).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  test('reloads once when manifest main bundle changes', async () => {
    const storage = createStorageMock();
    const reloadSpy = jest.fn();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ files: { 'main.js': '/static/js/main.newhash.js' } })
    });

    const firstRun = await checkForNewVersionOnce({
      currentMainJs: 'main.oldhash.js',
      fetchImpl: fetchMock as any,
      reloadImpl: reloadSpy,
      storage
    });

    const secondRun = await checkForNewVersionOnce({
      currentMainJs: 'main.oldhash.js',
      fetchImpl: fetchMock as any,
      reloadImpl: reloadSpy,
      storage
    });

    expect(firstRun).toBe(true);
    expect(secondRun).toBe(false);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith('force_reload_once_main.newhash.js', '1');
  });

  test('does not reload when manifest payload is malformed', async () => {
    const reloadSpy = jest.fn();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({})
    });

    const updated = await checkForNewVersionOnce({
      currentMainJs: 'main.oldhash.js',
      fetchImpl: fetchMock as any,
      reloadImpl: reloadSpy,
      storage: createStorageMock()
    });

    expect(updated).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});

describe('startVersionEnforcer', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('returns a cleanup function and does nothing outside production', () => {
    process.env.NODE_ENV = 'test';
    const cleanup = startVersionEnforcer();
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });
});
