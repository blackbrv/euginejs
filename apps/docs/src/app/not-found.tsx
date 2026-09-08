import { Inter, JetBrains_Mono } from "next/font/google";
import NotFoundPage from "@/components/landing/NotFoundPage";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

/**
 * Global 404 boundary — also what renders for `notFound()` calls from
 * `app/docs/[[...slug]]/page.tsx`, since there's no more specific
 * `not-found.tsx` under `app/docs/`. Thin metadata-only shell, same pattern
 * as `page.tsx`: the visual work lives in the `NotFoundPage` client component.
 */
export default function NotFound() {
  return <NotFoundPage fontClass={`${inter.variable} ${mono.variable}`} />;
}
