import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    renderer: "src/renderer.ts",
    server: "src/server.ts",
    versioning: "src/versioning.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
  splitting: false,
  treeshake: true,
  external: ["@eugine/core", "@eugine/renderer", "@eugine/renderer-server", "@eugine/versioning"],
});
