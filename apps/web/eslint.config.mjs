import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tailwind from 'eslint-plugin-tailwindcss';
import unusedImports from 'eslint-plugin-unused-imports';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
  ...tailwind.configs['flat/recommended'],
});

export default defineConfig([
  globalIgnores(['node_modules/', '.next']),
  {
    extends: compat.extends('next'),

    plugins: {
      'unused-imports': unusedImports,
      tailwindcss: tailwind,
    },

    settings: {
      tailwindcss: {
        config: false, // configless Tailwind v4
      },
    },

    rules: {
      '@next/next/no-img-element': 'off',
      'unused-imports/no-unused-imports': 'warn',
      'no-console': 'off',
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'tailwindcss/classnames-order': 'warn',
      'react/jsx-no-literals': 'off',
    },
  },
]);
