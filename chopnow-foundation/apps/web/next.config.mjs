/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allows this app to import TS source directly from workspace packages
  // (packages/ui, packages/lib, packages/types) without each package
  // needing its own build step during local development.
  transpilePackages: ["@chopnow/ui", "@chopnow/lib", "@chopnow/types"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
