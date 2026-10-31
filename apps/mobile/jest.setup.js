/* eslint-env jest, node */
/* Native modules have no implementation under Jest; these stand-ins keep their contracts. */
jest.mock('react-native-keychain', () => {
  const store = new Map();
  return {
    setGenericPassword: jest.fn(async (username, password, opts = {}) => {
      store.set(opts.service, { username, password, service: opts.service });
      return { service: opts.service, storage: 'mock' };
    }),
    getGenericPassword: jest.fn(async (opts = {}) => store.get(opts.service) ?? false),
    resetGenericPassword: jest.fn(async (opts = {}) => store.delete(opts.service)),
    __store: store,
  };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({ type: 'cancelled', data: null })),
    signOut: jest.fn(async () => null),
  },
  isSuccessResponse: (r) => r.type === 'success',
  statusCodes: {},
}));

if (!global.crypto) global.crypto = {};
if (!global.crypto.getRandomValues) {
  global.crypto.getRandomValues = (arr) => require('crypto').randomFillSync(arr);
}

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(async () => {
    throw Object.assign(new Error('cancelled'), { code: 'OPERATION_CANCELED' });
  }),
  isErrorWithCode: (e) => e != null && typeof e.code === 'string',
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  types: { csv: ['text/csv'], xlsx: 'xlsx', plainText: 'text/plain', pdf: 'application/pdf' },
  saveDocuments: jest.fn(async ({ sourceUris, fileName }) => [{ uri: `content://saved/${fileName}`, name: fileName, error: null, source: sourceUris[0] }]),
}));

/* File download to disk: records the request, answers with the status set on __next. */
jest.mock('react-native-blob-util', () => {
  const state = { next: [200], requests: [], unlinked: [] };
  const fetch = jest.fn(async (method, url, headers) => {
    state.requests.push({ method, url, headers });
    const status = state.next.length > 1 ? state.next.shift() : state.next[0];
    return { info: () => ({ status }) };
  });
  return {
    __esModule: true,
    default: {
      config: jest.fn(() => ({ fetch })),
      fs: { dirs: { CacheDir: '/cache' }, unlink: jest.fn(async (path) => void state.unlinked.push(path)) },
    },
    __state: state,
  };
});

/* MMKV is a Nitro (JSI) module: an in-memory store with the same calls, one per id. */
jest.mock('react-native-mmkv', () => {
  const stores = new Map();
  const createMMKV = (config = {}) => {
    const id = config.id ?? 'mmkv.default';
    if (!stores.has(id)) stores.set(id, new Map());
    const data = stores.get(id);
    return {
      set: (key, value) => data.set(key, value),
      getString: (key) => (typeof data.get(key) === 'string' ? data.get(key) : undefined),
      getNumber: (key) => (typeof data.get(key) === 'number' ? data.get(key) : undefined),
      getBoolean: (key) => (typeof data.get(key) === 'boolean' ? data.get(key) : undefined),
      contains: (key) => data.has(key),
      remove: (key) => data.delete(key),
      getAllKeys: () => [...data.keys()],
      clearAll: () => data.clear(),
    };
  };
  return { createMMKV };
});
