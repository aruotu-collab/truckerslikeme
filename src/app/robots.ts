import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", "/members"],
      },
    ],
    sitemap: "https://truckerslikeme.com/sitemap.xml",
    host: "https://truckerslikeme.com",
  };
}
