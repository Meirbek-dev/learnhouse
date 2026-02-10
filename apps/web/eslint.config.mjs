import tsParser from '@typescript-eslint/parser';
import js from '@eslint/js';

import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from '@typescript-eslint/eslint-plugin';
import tailwindcss from 'eslint-plugin-tailwindcss';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import react from 'eslint-plugin-react';

const COMMON_RULES = {
  '@next/next/no-img-element': 'off',
  '@next/next/no-sync-scripts': 'off',
  '@next/next/no-page-custom-font': 'off',

  'react/react-in-jsx-scope': 'warn',
  'react/prop-types': 'off',
  'react/no-unescaped-entities': 'off',
  'react/jsx-no-literals': 'off',

  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',
  'react-hooks/set-state-in-effect': 'warn',
  'react-hooks/incompatible-library': 'off',

  'tailwindcss/classnames-order': 'warn',
  'tailwindcss/no-custom-classname': 'off',

  'unused-imports/no-unused-imports': 'warn',

  'no-console': 'off',
};

export default [
  js.configs.recommended,

  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },

  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      tailwindcss,
      '@next/next': nextPlugin,
      'unused-imports': unusedImports,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        React: 'readonly',
        JSX: 'readonly',
      },
    },
    settings: {
      react: { version: 'detect' },
      tailwindcss: { config: false },
    },
    rules: COMMON_RULES,
  },

  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tseslint,
      react,
      'react-hooks': reactHooks,
      tailwindcss,
      '@next/next': nextPlugin,
      'unused-imports': unusedImports,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        React: 'readonly',
        JSX: 'readonly',
      },
    },
    settings: {
      react: { version: 'detect' },
      tailwindcss: { config: false },
    },
    rules: {
      ...COMMON_RULES,

      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/triple-slash-reference': 'warn',

      'no-undef': 'off',
      'no-redeclare': 'warn',
      'no-empty': 'warn',
      'no-unused-expressions': 'warn',
      'no-unused-vars': 'off',
    },
  },
];
