/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: process.env.BUILD_FOR === 'cloudflare' ? 'export' : undefined, // 静态导出（Cloudflare Pages）
}

module.exports = nextConfig
