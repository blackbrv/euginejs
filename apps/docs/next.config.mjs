import { createMDX } from "fumadocs-mdx/next";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: "/playground", destination: "/playground/index.html" }];
  },
};

const withMDX = createMDX();

export default withMDX(config);
