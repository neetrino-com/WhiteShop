/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@shop/ui', '@shop/design-tokens'],
  // Standalone output - prevents prerendering of 404 page
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        pathname: '/**',
      },
    ],
    // Allow unoptimized images for development (images will use unoptimized prop)
    // Ensure image optimization is enabled for production
    formats: ['image/avif', 'image/webp'],
    // In development, disable image optimization globally to allow any local IP
    // Components can still use unoptimized prop, but this ensures all images work
    unoptimized: process.env.NODE_ENV === 'development',
  },
  // Fix for HMR issues in Next.js 15
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    
    // Resolve workspace packages
    config.resolve.alias = {
      ...config.resolve.alias,
      '@shop/ui': path.resolve(__dirname, '../../packages/ui'),
      '@shop/design-tokens': path.resolve(__dirname, '../../packages/design-tokens'),
    };
    
    return config;
  },
  // Turbopack configuration for monorepo
  // Set root to the directory where package.json is located (where Next.js is installed)
  // On server: /var/www/WhiteShop/web
  // On local: apps/web
  // Use process.cwd() to get the current working directory where npm is run from
  turbopack: {
    root: process.cwd(),
  },
};

module.exports = nextConfig;

