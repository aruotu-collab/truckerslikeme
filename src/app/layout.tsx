import type { Metadata, Viewport } from "next";
import { Barlow, Oswald } from "next/font/google";
import { AuthGateProvider } from "@/lib/auth-gate";
import { AuthGateModal } from "@/components/auth-gate-modal";
import { MobileTabBar } from "@/components/mobile-tab-bar";
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

export const metadata: Metadata = {
  title: "TruckersLikeMe — Live road intelligence for truck drivers",
  description:
    "Parking, fuel, delays, and route intel from drivers on your corridor. Browse freely. Sign up when you save, post, or ask AI.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TruckersLikeMe",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
      <body className="min-h-full font-sans text-foreground">
        <AuthGateProvider>
          <LockHorizontalPan />
          <div className="app-shell">{children}</div>
          <MobileTabBar />
          <AuthGateModal />
        </AuthGateProvider>
      </body>
    </html>
  );
}
