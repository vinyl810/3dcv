/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep type-checking on, but don't block builds on lint style nits.
  eslint: { ignoreDuringBuilds: true },
  // three ships its add-ons (examples/jsm) as ESM that occasionally needs
  // explicit transpilation depending on the bundler version. Transpiling
  // `three` keeps imports like `three/examples/jsm/postprocessing/...` safe.
  transpilePackages: ['three'],
};

export default nextConfig;
