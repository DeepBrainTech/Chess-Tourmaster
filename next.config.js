/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // 静态导出（Cloudflare Pages）
}

module.exports = nextConfig
