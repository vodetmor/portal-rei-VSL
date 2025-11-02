import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  reactCompiler: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    minimumCacheTTL: 14400,
    maximumRedirects: 3,
    dangerouslyAllowLocalIP: false,
  },
};

export default nextConfig;
