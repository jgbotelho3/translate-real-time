import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "no-unused-vars": ["warn", { args: "none" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Icon fonts via <link> in layout.tsx are valid — disable the page-custom-font rule
      "@next/next/no-page-custom-font": "off",
    },
  },
]);

export default eslintConfig;
