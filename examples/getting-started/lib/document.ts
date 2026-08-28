import { createEmptyDocument, createNode, insertNode, type ComponentDefinition, type EugineDocument } from "eugine";

/**
 * Component definitions shared by both the server-rendered page and the
 * client editor. In a real app these — and their `render` implementations —
 * would usually live in one place per rendering context (see
 * lib/htmlRegistry.ts vs app/editor/page.tsx), but the *shape* (type,
 * accepts, defaults) is the same everywhere.
 */
export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  { type: "section", label: "Section", accepts: "*" },
  { type: "heading", label: "Heading", accepts: "none", defaults: { props: { content: "Heading" } } },
  { type: "text", label: "Text", accepts: "none", defaults: { props: { content: "Body text" } } },
];

/**
 * Stands in for "a document fetched from your database/API". This is the
 * exact shape `editor.serialize()` produces and `editor.load()` accepts —
 * see the PRD's "Document state" vs "Editor state" distinction: this JSON
 * is everything needed to reconstruct the page, nothing editor-only.
 */
export function createSampleDocument(): EugineDocument {
  let document = createEmptyDocument();
  const hero = createNode("section", { id: "hero" });
  document = insertNode(document, hero, document.rootId);
  document = insertNode(document, createNode("heading", { id: "heading", props: { content: "Build faster" } }), hero.id);
  document = insertNode(
    document,
    createNode("text", { id: "text", props: { content: "This page was rendered on the server with eugine/server — no editor runtime shipped to the browser." } }),
    hero.id,
  );
  return document;
}
