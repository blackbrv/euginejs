import { loader } from "fumadocs-core/source";
import { docs } from "@/.source/server";

/** The content tree behind every docs route, built from content/docs. */
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
