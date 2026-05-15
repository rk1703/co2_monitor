/**
 * Next.js config: stub optional native modules that cause bundling errors
 * and keep other defaults.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Some native optional modules (dtrace-provider) are not available on Windows
    // and cause compilation errors. Provide harmless stubs so ldapjs and canvas can be used.
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['dtrace-provider'] = false;
    config.resolve.alias.canvas = false;

    return config;
  },
};

module.exports = nextConfig;
