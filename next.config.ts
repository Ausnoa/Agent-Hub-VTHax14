import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@a2a-js/sdk", "undici"],
  poweredByHeader: false,
};
export default config;
