import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eugine — Kitchen Sink example",
  description: "A comprehensive Next.js example exercising every MVP feature in eugine.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
