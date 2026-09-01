import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/playground/" : "/",
  server: {
    port: 5183,
  },
}));
