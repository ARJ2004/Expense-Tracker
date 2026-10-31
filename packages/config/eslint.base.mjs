import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/** Shared lint rules for every TypeScript package in the repo. */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='parseFloat']",
          message: 'Money is integer paise; use toPaise() from @et/domain instead of parseFloat.',
        },
      ],
    },
  },
);
