import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { THEME_SCRIPT } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "ThirdEye",
  description: "Single source of truth for leads, quotes, bookings, margins and follow-ups",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
