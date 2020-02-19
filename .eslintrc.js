module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: ['plugin:@typescript-eslint/recommended'],
    rules: {
      "@typescript-eslint/indent": ["warn", 2],
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/interface-name-prefix": ["error", "always"],
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/member-ordering": "error",
    },
  }
