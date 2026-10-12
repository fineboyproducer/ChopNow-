import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ThemeProvider, Toaster } from "@chopnow/ui";
import "@chopnow/ui/src/globals.css";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

export const metadata: Metadata = {
  title: {
    default: "ChopNow Rider",
    template: "%s · ChopNow Rider",
  },
  description: "Accept deliveries, navigate, and track your earnings with ChopNow.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ChopNow Rider",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#FF6B00",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <Toaster />
        </ThemeProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
