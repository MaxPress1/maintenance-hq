import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  { ignores: [".next/**", "node_modules/**", "coverage/**", "dist/**", ".test-runtime/**", "supabase/.validation-*/**"] },
];

export default eslintConfig;
