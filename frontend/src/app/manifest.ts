import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KHETNITI · खेतनीति",
    short_name: "KHETNITI",
    description: "Smart Decisions. Better Harvests. Weather, mandi prices and selling economics for Indian farmers.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0d3b2b",
    theme_color: "#0d3b2b",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
