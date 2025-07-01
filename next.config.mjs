/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  images: {
    domains: ['lh3.googleusercontent.com'], // For Google profile images
  },
  // Ensure API routes are handled server-side
  experimental: {
    serverActions: true,
  },
};

export default nextConfig;

 