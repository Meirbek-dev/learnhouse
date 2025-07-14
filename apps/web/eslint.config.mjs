import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import unusedImports from 'eslint-plugin-unused-imports';
import { defineConfig, globalIgnores } from 'eslint/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  globalIgnores(['node_modules/', '.next']),
  {
    extends: compat.extends('next'),

    plugins: {
      'unused-imports': unusedImports,
    },

    rules: {
      '@next/next/no-img-element': 'off',
      'unused-imports/no-unused-imports': 'warn',
      'no-console': 'off',
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      // 'react/jsx-no-literals': 'warn',
    },
  },
]);
