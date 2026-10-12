import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider, Toaster } from "@chopnow/ui";
import "@chopnow/ui/src/globals.css";

export const metadata: Metadata = {
  title: {
    default: "ChopNow Admin",
    template: "%s · ChopNow Admin",
  },
  description: "Internal operations dashboard for the ChopNow team.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
