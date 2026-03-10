// eslint.config.mjs  -  ESLint v10 flat config
import tsParser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';

// Plugins
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import next from '@next/eslint-plugin-next';
import react from 'eslint-plugin-react';

// ─────────────────────────────────────────────────────────────
// Shared rules applied to both JS and TS files
// ─────────────────────────────────────────────────────────────
const COMMON_RULES = {
  // ── Next.js ──────────────────────────────────────────────
  '@next/next/no-img-element': 'off',
  '@next/next/no-sync-scripts': 'off',
  '@next/next/no-page-custom-font': 'off',

  // ── React ─────────────────────────────────────────────────
  'react/prop-types': 'off', // Covered by TypeScript
  'react/no-unescaped-entities': 'off', // Too noisy with i18n content
  'react/jsx-no-literals': 'warn', // next-intl handles i18n; this is too noisy
  'react/self-closing-comp': 'warn', // <Foo></Foo> → <Foo />
  'react/jsx-boolean-value': ['warn', 'never'], // foo={true} → foo
  'react/no-array-index-key': 'off', // Fragile list keys
  'react/no-danger': 'off', // Flag dangerouslySetInnerHTML

  // ── React Hooks ───────────────────────────────────────────
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',

  // ── Accessibility (jsx-a11y) ──────────────────────────────
  'jsx-a11y/alt-text': 'warn',
  'jsx-a11y/no-autofocus': 'warn',
  'jsx-a11y/anchor-is-valid': 'warn',

  // ── Imports ───────────────────────────────────────────────
  'unused-imports/no-unused-imports': 'warn',
  'unused-imports/no-unused-vars': 'off',

  // ── Code quality ─────────────────────────────────────────
  'no-console': 'off',
  'no-var': 'error',
  'prefer-const': 'warn',
  'eqeqeq': ['error', 'always', { null: 'always' }],
  'no-unused-expressions': ['warn', { allowShortCircuit: true, allowTernary: true }],
  'no-empty': ['warn', { allowEmptyCatch: false }],
  'no-redeclare': 'warn',
  'no-unused-vars': 'off',
};

export default defineConfig([
  // ─────────────────────────────────────────────────────────
  // eslint:recommended baseline
  // ─────────────────────────────────────────────────────────
  {
    ...js.configs.recommended,
    name: 'eslint:recommended',
  },

  // ─────────────────────────────────────────────────────────
  // Global ignores
  // ─────────────────────────────────────────────────────────
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      '*.config.{js,mjs,ts}', // Build tool configs - often intentionally loose
    ],
  },

  // ─────────────────────────────────────────────────────────
  // JavaScript / JSX
  // ─────────────────────────────────────────────────────────
  {
    name: 'js/jsx',
    files: ['**/*.{js,jsx,mjs,cjs}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      '@next/next': next,
      'unused-imports': unusedImports,
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: COMMON_RULES,
  },

  // ─────────────────────────────────────────────────────────
  // TypeScript / TSX
  // ─────────────────────────────────────────────────────────
  {
    name: 'ts/tsx',
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tseslint,
      react,
      'react-hooks': reactHooks,
      '@next/next': next,
      'unused-imports': unusedImports,
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...COMMON_RULES,

      // ── TypeScript-specific ───────────────────────────────
      '@typescript-eslint/no-explicit-any': 'off', // Nudge away from any
      '@typescript-eslint/no-unused-vars': 'off', // Handled by unused-imports above
      '@typescript-eslint/no-require-imports': 'warn', // Prefer ESM imports
      '@typescript-eslint/no-unsafe-function-type': 'off', // Avoid `Function` type
      '@typescript-eslint/triple-slash-reference': 'warn',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/promise-function-async': 'off',
      '@typescript-eslint/consistent-type-imports': [
        // import type { Foo }
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // ── Core JS overrides for TS files ────────────────────
      'no-undef': 'off', // TypeScript handles this
      'no-redeclare': 'off', // Use TS version instead
      '@typescript-eslint/no-redeclare': 'warn',
    },
  },
]);
