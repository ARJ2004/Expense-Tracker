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
}));
