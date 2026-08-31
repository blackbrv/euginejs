import { Inter, JetBrains_Mono } from "next/font/google";
import LandingPage from "@/components/landing/LandingPage";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

/**
 * Landing page. The visual + interactive work lives in the `LandingPage`
 * client component (spotlight cards, command palette, workflow visualizer);
 * this file is intentionally a thin metadata-only shell that supplies the
 * Inter / JetBrains Mono font tokens.
 */
export default function Home() {
  return <LandingPage fontClass={`${inter.variable} ${mono.variable}`} />;
}
