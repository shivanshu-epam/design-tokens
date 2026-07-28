// design-tokens.json is ~1.6MB with 10k+ keys — letting TypeScript infer a
// full literal type for it via resolveJsonModule is slow and pointless
// (tokens.ts casts it to TokenSet immediately anyway). This ambient
// declaration makes JSON imports resolve to `any` instead, so `tsc` never
// attempts that inference. Vite still handles the actual import at
// bundle/runtime regardless of this file — it's type-checking only.
declare module '*.json' {
  const value: unknown;
  export default value;
}
