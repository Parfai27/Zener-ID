import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Old addresses from the Vite frontend keep working.
  async redirects() {
    return [
      { source: '/signup', destination: '/register', permanent: true },
      { source: '/app', destination: '/dashboard', permanent: true },
      { source: '/app/:path*', destination: '/dashboard/:path*', permanent: true },
    ]
  },
}

export default nextConfig
