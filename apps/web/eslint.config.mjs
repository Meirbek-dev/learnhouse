// eslint.config.mjs
import tsParser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';

// ESLint plugins (explicit imports for flat config)
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from '@typescript-eslint/eslint-plugin';
import tailwindcss from 'eslint-plugin-tailwindcss';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import react from 'eslint-plugin-react';

/**
 * Centralized plugin map for reuse in overrides.
 * Casting to `any` avoids TS type mismatches between ESLint plugin shapes.
 */
const PLUGINS = /** @type {const} */ ({
  '@typescript-eslint': /** @type {any} */ (tseslint),
  'react': /** @type {any} */ (react),
  'react-hooks': /** @type {any} */ (reactHooks),
  'tailwindcss': /** @type {any} */ (tailwindcss),
  '@next/next': /** @type {any} */ (nextPlugin),
  'unused-imports': /** @type {any} */ (unusedImports),
});

/** Shared React + Next + Tailwind rules */
const COMMON_RULES = {
  '@next/next/no-img-element': 'off',
  '@next/next/no-sync-scripts': 'off',
  'react/react-in-jsx-scope': 'off',
  'react/prop-types': 'off',
  'react/no-unescaped-entities': 'off',
  'react/jsx-no-literals': 'off',
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',
  'react-hooks/set-state-in-effect': 'off',
  'react-hooks/incompatible-library': 'off',
  'tailwindcss/classnames-order': 'warn',
  'unused-imports/no-unused-imports': 'warn',
  'no-console': 'off',
};

export default defineConfig([
  // ───────────────────────────────
  // Root-level ignores
  // ───────────────────────────────
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },

  // ───────────────────────────────
  // JavaScript / JSX
  // ───────────────────────────────
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    plugins: {
      'react': PLUGINS.react,
      'react-hooks': PLUGINS['react-hooks'],
      'tailwindcss': PLUGINS.tailwindcss,
      '@next/next': PLUGINS['@next/next'],
      'unused-imports': PLUGINS['unused-imports'],
    },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: { React: 'readonly', JSX: 'readonly' },
    },
    settings: {
      react: { version: 'detect' },
      tailwindcss: { config: false },
    },
    // Cast to any to avoid TS type mismatch with RuleConfig in flat config
    rules: /** @type {any} */ (COMMON_RULES),
  },

  // ───────────────────────────────
  // TypeScript / TSX
  // ───────────────────────────────
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': PLUGINS['@typescript-eslint'],
      'react': PLUGINS.react,
      'react-hooks': PLUGINS['react-hooks'],
      'tailwindcss': PLUGINS.tailwindcss,
      '@next/next': PLUGINS['@next/next'],
      'unused-imports': PLUGINS['unused-imports'],
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json',
      },
      globals: { React: 'readonly', JSX: 'readonly' },
    },
    settings: {
      react: { version: 'detect' },
      tailwindcss: { config: false },
    },
    // Cast combined rules to any to satisfy TypeScript for RuleConfig
    rules: /** @type {any} */ ({
      ...COMMON_RULES,
      // TypeScript-specific relaxations (incremental adoption)
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-undef': 'off',
      'no-redeclare': 'warn',
      'no-empty': 'warn',
      'no-unused-expressions': 'warn',
      'tailwindcss/no-custom-classname': 'off',
    }),
  },
]);
