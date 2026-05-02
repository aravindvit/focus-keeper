import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      strategies: "generateSW",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Focus Keeper",
        short_name: "Focus",
        description: "Science-backed focus sessions with NSDR rest.",
        start_url: "/",
        display: "standalone",
        background_color: "#131316",
        theme_color: "#131316",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"]
      }
    })
  ]
});
