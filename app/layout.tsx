import type { Metadata } from "next";
import "./globals.css";
import ReferralNotice from "@/components/referral-notice";
import "./affiliates.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://dexlyy.com",
  ),
  title: {
    default: "Dexlyy — AI Voice Interviews for FiveM Servers",
    template: "%s | Dexlyy",
  },
  description:
    "Run structured FiveM whitelist interviews 24/7. Dexlyy handles AI voice interviews, Discord verification, recordings, transcripts, staff review, and automatic role assignment.",
  keywords: [
    "FiveM whitelist interview",
    "FiveM application bot",
    "Discord whitelist bot",
    "AI voice interview",
    "FiveM server management",
    "roleplay server applications",
  ],
  authors: [{ name: "Dexlyy" }],
  creator: "Dexlyy",
  publisher: "Dexlyy",
  category: "technology",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Dexlyy",
    title: "Dexlyy — Your FiveM Interview Room, Open 24/7",
    description:
      "AI voice interviews, Discord verification, recordings, transcripts, and human approval in one polished FiveM whitelist workflow.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Dexlyy FiveM whitelist interview platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dexlyy — AI Voice Interviews for FiveM Servers",
    description:
      "Keep your FiveM whitelist interview room open 24/7 while your staff stays in control.",
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
  icons: { icon: "/dexlyy-logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><ReferralNotice />{children}</body>
    </html>
  );
}
