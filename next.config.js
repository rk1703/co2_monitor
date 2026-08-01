/**
 * Next.js config
 * ldapts is pure JavaScript, so no webpack stubs needed
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['mssql'],
  },
};

module.exports = nextConfig;
