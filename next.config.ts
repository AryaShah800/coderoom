import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
    resolveAlias: {
      // y-monaco imports "monaco-editor/esm/vs/editor/editor.api.js", which monaco-editor 0.57's
      // "exports" map no longer resolves. Point it at the same ESM module the editor uses.
      "monaco-editor/esm/vs/editor/editor.api.js": "monaco-editor/editor/editor.api.js",
      // Monaco 0.57.0 vendors DOMPurify 3.4.15 (identical to upstream, affected by GHSA advisories
      // fixed in 3.4.17). Load the official patched package instead of the vendored copy.
      // scripts/verify-monaco-bundle.mjs checks the built chunks for the patched version.
      "./dompurify/dompurify.js": "dompurify",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
