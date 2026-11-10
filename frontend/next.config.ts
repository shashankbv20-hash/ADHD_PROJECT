import type { NextConfig } from "next";

/**
 * Baseline security headers for every route.
 *
 * Deliberately NOT included:
 * - A script/style Content-Security-Policy. A nonce-based CSP requires fully dynamic rendering,
 *   which this app's static shell (cacheComponents) does not use; an allow-list CSP would either
 *   break Next.js inline scripts or need 'unsafe-inline' and add little. The directives below
 *   (frame-ancestors, object-src, base-uri, form-action) never block the app's own scripts.
 * - Cross-Origin-Opener-Policy. Firebase sign-in with a popup needs window.opener access.
 * - A camera/microphone allowance. Permissions-Policy denies both because nothing here uses
 *   them; the planned webcam feature must relax `camera` deliberately, with consent.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
  // Only meaningful over HTTPS; browsers ignore it on plain http (local development).
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
