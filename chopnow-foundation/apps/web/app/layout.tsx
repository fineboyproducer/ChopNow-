import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider, Toaster } from "@chopnow/ui";
import "@chopnow/ui/src/globals.css";

export const metadata: Metadata = {
  title: {
    default: "ChopNow — Order. Relax. Enjoy.",
    template: "%s · ChopNow",
  },
  description:
    "Order hot meals from trusted restaurants in Ekpoma, Edo State, delivered fast and tracked live.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
