import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server's /_next/* resources (HMR, client bundle, RSC fetches)
  // to be requested from other devices on the LAN — otherwise Next 16 blocks
  // them cross-origin and the page loads its shell but never hydrates (blank
  // content) on anything hitting the machine by IP instead of localhost.
  // Add whatever host/IP you actually browse from on your phone here.
  allowedDevOrigins: ["10.0.0.178"],
};

export default nextConfig;
