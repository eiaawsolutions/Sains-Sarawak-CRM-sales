/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // Railway-friendly — ships a minimal runtime
  outputFileTracingIncludes: {
    "/docs/**": ["./src/content/docs/**"],
    "/api/quotations/**": ["./public/fonts/**", "./public/sains-logo.png"],
    "/api/reports/**": ["./public/fonts/**", "./public/sains-logo.png"],
  },
  experimental: {
    serverActions: { allowedOrigins: ["*"] },
  },
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Security headers mirror the .NET build — every header SAINS expects from a gov-grade app.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options",    value: "nosniff" },
          { key: "X-Frame-Options",           value: "DENY" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
