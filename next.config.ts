import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Esconde o indicador de dev do Next (o círculo com "N" no canto).
  devIndicators: false,
  // Permite acesso ao dev server via túnel (ngrok) sem aviso de cross-origin.
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.io"],
  images: {
    // Qualidades permitidas na otimização. Uma qualidade fora desta lista faz o
    // /_next/image responder 400 — a imagem simplesmente não carrega.
    // 82 = hero e fotos de produto (fonte já é WebP); 90 = detalhe do produto.
    qualities: [75, 82, 90],
    // Fotos de produto vêm do Supabase Storage. O host é preenchido a partir
    // da URL do projeto Supabase (NEXT_PUBLIC_SUPABASE_URL) quando configurado.
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol: "https",
            hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
