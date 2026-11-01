import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Auth.js beta.32 issues its own unauthenticated redirect from server
  // components to the built-in "/login" path and ignores `pages.signIn` there.
  // The real sign-in screen lives at /auth/login, so map the internal target
  // instead of duplicating the page.
  async redirects() {
    return [
      { source: "/login", destination: "/auth/login", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
