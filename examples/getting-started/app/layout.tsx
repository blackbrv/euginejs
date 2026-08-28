import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eugine — Getting Started example",
  description: "Minimal Next.js example for the eugine visual editor engine.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/">Server-rendered page</Link>
          <Link href="/editor">Interactive editor</Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
