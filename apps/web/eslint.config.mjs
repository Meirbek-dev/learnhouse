import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import tsParser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';
import next from '@next/eslint-plugin-next';
import react from 'eslint-plugin-react';

const COMMON_RULES = {
  // Next.js
  '@next/next/no-img-element': 'off',
  '@next/next/no-sync-scripts': 'off',
  '@next/next/no-page-custom-font': 'off',

  // React
  'react/prop-types': 'off',
  'react/no-unescaped-entities': 'off',
  'react/jsx-no-literals': 'off', // Detect hardcoded strings

  // React Hooks
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',
  'react-hooks/set-state-in-effect': 'warn',
  'react-hooks/incompatible-library': 'off',

  // Hygiene
  'unused-imports/no-unused-imports': 'warn',
  'no-console': 'off',
};

export default defineConfig([
  // ─────────────────────────────────────────────
  // Global ignores
  // ─────────────────────────────────────────────
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },

  // ─────────────────────────────────────────────
  // JavaScript / JSX
  // ─────────────────────────────────────────────
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      '@next/next': next,
      'unused-imports': unusedImports,
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

  // ─────────────────────────────────────────────
  // TypeScript / TSX
  // ─────────────────────────────────────────────
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tseslint,
      react,
      'react-hooks': reactHooks,
      '@next/next': next,
      'unused-imports': unusedImports,
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

      // TypeScript
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/triple-slash-reference': 'warn',

      // Core overrides (JSX refs now tracked)
      'no-undef': 'off',
      'no-redeclare': 'warn',
      'no-empty': 'warn',
      'no-unused-expressions': 'warn',
    },
  },
]);
