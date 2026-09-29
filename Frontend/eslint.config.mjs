import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The codebase intentionally uses dynamic JSON-shaped records from the
      // embedded database layer. `any` is used to keep data shims pragmatic and
      // does not affect runtime behaviour.
      "@typescript-eslint/no-explicit-any": "off",
      // Local UI helpers frequently set local state from freshly fetched data.
      "react-hooks/set-state-in-effect": "off",
      // Server-rendered analytics may legitimately compute "today"/cutoffs.
      "react-hooks/purity": "off",
      // React Compiler memoization guidance is not required for runtime behaviour.
      "react-hooks/preserve-manual-memoization": "off",
      // SVG/static product imagery is referenced by URL in this prototype.
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "**/.next/**",
    "out/**",
    "**/out/**",
    "build/**",
    "**/build/**",
    "node_modules/**",
    "**/node_modules/**",
    "next-env.d.ts",
    "**/next-env.d.ts",
  ]),
]);

export default eslintConfig;
