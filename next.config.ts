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
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'reidavsl.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      }
    ]
  },
};

export default nextConfig;
