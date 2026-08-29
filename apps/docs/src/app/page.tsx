import { redirect } from "next/navigation";

/** The site is documentation only for now; `/` is reserved for a landing page. */
export default function Home() {
  redirect("/docs");
}
