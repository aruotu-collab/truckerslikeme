import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", "/members", "/admin"],
      },
    ],
    sitemap: "https://truckerslikeme.com/sitemap.xml",
  };
}
