/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // 启用 standalone 模式，用于 Docker 部署
}

module.exports = nextConfig
