import type { Config } from "tailwindcss";
import sharedConfig from "../../packages/ui/tailwind.config.base";

const config: Config = {
  ...sharedConfig,
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
} as Config;

export default config;
