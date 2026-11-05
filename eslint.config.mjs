// Zena – shared ESLint flat config (ESLint v9+).
// Each workspace package can extend this by importing it.
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import prettier from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    // Apply to all TypeScript source files across the monorepo.
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier,
    },
    rules: {
      // TypeScript strict rules
      ...tsPlugin.configs['recommended'].rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',

      // Prettier as a lint rule so a single `pnpm lint` checks both
      'prettier/prettier': 'error',

      // Disable rules that prettier handles
      ...prettierConfig.rules,
    },
  },
  {
    // Ignore build artefacts, generated files, and infra placeholders.
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/.turbo/**', 'infra/**'],
  },
]

export default config
