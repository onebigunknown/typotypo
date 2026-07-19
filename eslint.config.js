const eslint = require('@eslint/js')
const tseslint = require('typescript-eslint')
const figmaPlugin = require('@figma/eslint-plugin-figma-plugins')

const defaultUnusedVariablesRule = [
  'error',
  {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
  },
]

module.exports = tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    plugins: {
      '@figma/figma-plugins': figmaPlugin,
    },
    rules: {
      ...figmaPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': defaultUnusedVariablesRule,
    },
  },
  {
    files: ['code.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern:
            '^(?:_.*|getTextStyleSnapshots|applyStyleSnapshotsToFormattedText|loadFontsFromStyleSnapshots)$',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['typography-engine.ts'],
    rules: {
      '@typescript-eslint/no-namespace': 'off',
      'no-useless-escape': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern:
            '^(?:_.*|TypotypoEngine|isOpeningQuotePosition)$',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    ignores: [
      'node_modules/**',
      'code.js',
      'typography-engine.js',
      'dist/**',
      '.cursor/**',
      'eslint.config.js',
    ],
  },
)
