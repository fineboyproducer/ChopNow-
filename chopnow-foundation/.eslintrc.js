module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint"],
  ignorePatterns: [
    "node_modules/",
    ".next/",
    "dist/",
    "build/",
    "*.config.js",
    "*.config.mjs",
    "supabase/migrations/**",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx"],
      env: { jest: true },
    },
  ],
};
