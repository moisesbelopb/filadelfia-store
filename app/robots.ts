import { SITE_URL } from "@/lib/env";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Áreas privadas não precisam ser rastreadas.
      disallow: ["/admin", "/conta", "/pedidos", "/checkout", "/carrinho"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
