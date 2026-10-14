import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@chopnow/types": path.resolve(__dirname, "../../packages/types/src/index.ts"),
      "@chopnow/lib": path.resolve(__dirname, "../../packages/lib/src/index.ts"),
      "@/": path.resolve(__dirname, "./") + "/",
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
});
