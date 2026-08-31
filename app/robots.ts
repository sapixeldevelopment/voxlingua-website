import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/portal/"],
      disallow: [
        "/api/",
        "/auth/",
        "/dashboard/",
        "/interview/",
        "/login",
        "/staff/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
