import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Carried over from ScreenSlick, where the studio was born: visible, not blocking.
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The helper has its own tsconfig and build.
    "packages/**",
    // Video style presets: workspace scene code (built by the helper, not this app).
    "motion/presets/**",
    // Generated worker and vendored MediaPipe runtime, built by prepare:vision.
    "public/vision/face-detector.js",
    "public/vision/wasm/**",
  ]),
]);

export default eslintConfig;
