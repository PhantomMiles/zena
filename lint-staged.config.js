/** @type {import('lint-staged').Config} */
export default {
  // Type-check and lint staged TypeScript files
  '*.{ts,tsx,mts,cts}': ['eslint --fix', 'prettier --write'],
  // Format everything else Prettier understands
  '*.{js,mjs,json,md,yaml,yml}': ['prettier --write'],
}
