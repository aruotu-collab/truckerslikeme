import type { Metadata, Viewport } from "next";
import { Barlow, Oswald } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { AuthGateProvider } from "@/lib/auth-gate";
import { AuthGateModal } from "@/components/auth-gate-modal";
import { LockHorizontalPan } from "@/components/lock-horizontal-pan";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const siteUrl = "https://truckerslikeme.com";
const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TruckersLikeMe — Live road intelligence for truck drivers",
    template: "%s · TruckersLikeMe",
  },
  description:
    "Parking, fuel, delays, and route intel from drivers on your corridor. Browse freely. Sign up when you save, post, or ask AI.",
  applicationName: "TruckersLikeMe",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "TruckersLikeMe",
    title: "TruckersLikeMe — Live road intelligence for truck drivers",
    description:
      "Parking, fuel, delays, and route intel from drivers on your corridor.",
  },
  twitter: {
    card: "summary_large_image",
    title: "TruckersLikeMe — Live road intelligence for truck drivers",
    description:
      "Parking, fuel, delays, and route intel from drivers on your corridor.",
  },
  verification: googleVerification
    ? { google: googleVerification }
    : undefined,
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#1a1d23",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${oswald.variable} h-full antialiased`}
    >
      <body className="min-h-full overflow-x-clip font-sans text-foreground">
        <AuthGateProvider>
          <LockHorizontalPan />
          <div className="site-shell">{children}</div>
          <AuthGateModal />
        </AuthGateProvider>
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
      </body>
    </html>
  );
}
