import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";
import { Preloader } from "@/components/Preloader";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider theme={{ defaultTheme: "dark" }}>{children}</RootProvider>
        <Preloader />
      </body>
    </html>
  );
}
