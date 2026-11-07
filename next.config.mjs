/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', 'web-push'],
  outputFileTracingIncludes: {
    '/**': ['./node_modules/better-sqlite3/**', './node_modules/web-push/**'],
  },
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  experimental: {
    serverActions: { bodySizeLimit: '12mb' },
  },
};

export default nextConfig;
