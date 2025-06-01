import { defineConfig, globalIgnores } from "eslint/config";
import unusedImports from "eslint-plugin-unused-imports";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
});

export default defineConfig([
	globalIgnores(["node_modules/", ".next"]),
	{
		extends: compat.extends("next"),

		plugins: {
			"unused-imports": unusedImports,
		},

		rules: {
			"@next/next/no-img-element": "off",
			"unused-imports/no-unused-imports": "off",
			"no-console": "off",
			"react/no-unescaped-entities": "off",
			"react-hooks/exhaustive-deps": "off",
			// 'react/jsx-no-literals': 'warn',
		},
	},
]);
