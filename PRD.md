# Eugine

## Expandable JavaScript Visual Editor & Page Builder Engine

**Product Name:** Eugine
**Product Type:** JavaScript library / editor engine / page-builder framework
**Distribution:** npm
**Primary Language:** JavaScript
**Recommended Development Language:** TypeScript with JavaScript-compatible public API
**Primary Audience:** JavaScript developers, frontend developers, product teams, SaaS builders, agencies, CMS developers, low-code platform developers
**Primary Inspiration:** Craft.js, GrapesJS, modern component systems, visual page builders
**Status:** Product Definition / Architecture PRD

---

# 1. Executive Summary

**Eugine** is an extensible JavaScript library designed to provide the foundational engine required to build modern drag-and-drop visual editors and page builders.

Eugine is **not intended to be a complete website builder by itself**.

Instead, Eugine provides the underlying infrastructure that allows developers to build their own visual editors.

A developer should be able to install Eugine from npm and build a completely customized editor around it.

For example:

```text
My SaaS
│
├── My Toolbar
├── My Sidebar
├── My Component Library
├── My Design System
├── My Property Panel
├── My Templates
├── My Backend
└── Eugine
      ├── Editor Engine
      ├── Document Model
      ├── Drag & Drop
      ├── Selection
      ├── History
      ├── Serialization
      ├── Renderer
      ├── Component Registry
      └── Plugin System
```

The developer controls the experience.

Eugine provides the engine.

The core philosophy is:

> **Eugine gives developers the engine. Developers build the editor.**

---

# 2. Product Vision

Create a lightweight, framework-friendly, highly extensible visual editing engine that allows developers to build their own:

- Page builders
- Email builders
- Landing page builders
- CMS editors
- Website builders
- Dashboard builders
- Form builders
- Design tools
- No-code/low-code editors
- Content editors
- Internal design systems
- Collaborative editors

without having to implement the underlying visual editing engine from scratch.

---

# 3. Product Mission

Eugine should make building a custom visual editor significantly easier.

Instead of developers spending months implementing:

- drag-and-drop
- selection
- component trees
- undo/redo
- history
- serialization
- component registration
- keyboard shortcuts
- rendering
- persistence
- plugin APIs

they should be able to install Eugine and focus on building their product experience.

---

# 4. Core Product Proposition

Eugine should provide:

> **A small, composable editor engine with a powerful document model and an extensible rendering/runtime architecture.**

The product should prioritize:

1. Developer experience
2. Extensibility
3. Small bundle size
4. Framework flexibility
5. Predictable state management
6. Serializable documents
7. Server rendering
8. Component interoperability
9. Long-term backwards compatibility

---

# 5. Market & Ecosystem Research

Eugine sits in an ecosystem containing projects such as:

- Craft.js
- GrapesJS
- Editor.js
- Lexical
- ProseMirror
- Tiptap
- BlockNote
- various low-code/page-builder frameworks

Craft.js demonstrates the value of a framework for constructing customizable React page editors.

GrapesJS demonstrates the importance of:

- component models
- component trees
- project persistence
- custom components
- export
- storage
- editor plugins

GrapesJS documentation explicitly separates the component model, which stores component properties and project data, from the visual component view.

Its documentation also emphasizes that JSON project data should be the persistence source rather than using exported HTML/CSS as the canonical editor state.

Eugine should learn from these architectural patterns while deliberately targeting a more modular and developer-controlled architecture.

---

# 6. Differentiation

Eugine should differentiate itself from traditional page builders through:

### 6.1 Engine-first architecture

Eugine provides an engine rather than forcing developers into a predefined editor UI.

### 6.2 Renderer independence

The document model should not fundamentally depend on a particular renderer.

### 6.3 Server compatibility

The document should be renderable without requiring browser APIs.

### 6.4 Framework flexibility

The core should avoid unnecessary coupling to React.

### 6.5 Component ecosystem

Developers should be able to bring their own:

- React components
- Web Components
- HTML structures
- Tailwind components
- styled components
- design-system components

where technically compatible.

### 6.6 Plugin-first extensibility

Advanced functionality should be implemented as plugins rather than bloating the core.

---

# 7. Target Users

## Persona A — SaaS Developer

Building:

> “A website builder for my customers.”

Needs:

- editor engine
- components
- persistence
- rendering
- custom UI

---

## Persona B — CMS Developer

Building:

> “A visual content editor for our CMS.”

Needs:

- structured content
- server rendering
- API persistence
- component restrictions

---

## Persona C — Agency

Building:

> “A custom page builder for clients.”

Needs:

- templates
- reusable blocks
- branding
- export
- custom components

---

## Persona D — Design System Developer

Needs:

- component registry
- design tokens
- reusable components
- property editing

---

## Persona E — Collaborative SaaS Developer

Building:

> “A Figma-like collaborative page builder.”

Needs:

- real-time document updates
- presence
- conflict resolution
- operation synchronization

---

# 8. Primary Use Cases

Eugine should support developers building:

### Website builders

```text
Drag Section
→ Add Hero
→ Edit Text
→ Change Button
→ Add Image
→ Save
→ Publish
```

### Landing page builders

```text
Canvas
├── Hero
├── Features
├── Pricing
├── Testimonials
└── Footer
```

### Email builders

```text
Email
├── Header
├── Content
├── CTA
└── Footer
```

### CMS visual editors

```text
CMS Content
→ API
→ Eugine Document
→ Renderer
→ HTML
```

### Dashboard builders

```text
Dashboard
├── Chart
├── Table
├── KPI
└── Activity Feed
```

---

# 9. Product Architecture

Eugine should be composed of several conceptual layers.

```text
┌──────────────────────────────────────────────┐
│                 Application                  │
│      Developer's Custom Page Builder        │
├──────────────────────────────────────────────┤
│              Eugine UI / Adapter             │
├──────────────────────────────────────────────┤
│              Eugine Editor Engine            │
│                                              │
│  Selection                                    │
│  Drag & Drop                                  │
│  Commands                                     │
│  History                                      │
│  Keyboard                                     │
│  Events                                       │
│  Plugin Runtime                               │
├──────────────────────────────────────────────┤
│              Document Model                   │
│                                              │
│  Nodes                                         │
│  Tree                                          │
│  Props                                         │
│  Styles                                        │
│  Metadata                                      │
├──────────────────────────────────────────────┤
│              Renderer                         │
│                                              │
│  DOM Renderer                                  │
│  React Renderer                                │
│  Server Renderer                               │
│  HTML Exporter                                 │
├──────────────────────────────────────────────┤
│              Persistence                      │
│                                              │
│  JSON                                          │
│  Storage Adapter                               │
│  API                                           │
│  Local Storage                                 │
├──────────────────────────────────────────────┤
│              Optional Plugins                │
│                                              │
│  Collaboration                                 │
│  Templates                                     │
│  Assets                                        │
│  AI                                            │
│  Comments                                      │
└──────────────────────────────────────────────┘
```

---

# 10. Core Architectural Principle

The most important architectural rule is:

> **The document model must not depend on the editor UI.**

This allows:

```text
Editor
     ↓
Document JSON
     ↓
Server
     ↓
Renderer
     ↓
HTML
```

without requiring the editor itself to run.

This is critical for SSR.

---

# 11. Document Model

The document model is the heart of Eugine.

Every visual design should be represented as a tree.

Example:

```json
{
  "version": 1,
  "root": {
    "id": "root",
    "type": "root",
    "children": [
      {
        "id": "hero",
        "type": "section",
        "props": {
          "className": "hero"
        },
        "children": [
          {
            "id": "heading",
            "type": "text",
            "props": {
              "content": "Build faster"
            }
          }
        ]
      }
    ]
  }
}
```

The exact schema should remain implementation-defined until architecture validation, but the concepts should remain stable.

---

# 12. Node Requirements

Every node should support:

- unique ID
- type
- props
- children
- parent relationship
- metadata
- optional styles
- optional class names
- optional event metadata
- optional custom data

Example conceptual node:

```text
Node
├── id
├── type
├── props
├── styles
├── children
├── metadata
└── customData
```

---

# 13. Component Registry

Developers must be able to register custom components.

Conceptually:

```javascript
editor.registerComponent({
  type: "hero",
  component: Hero,
  defaults: {
    title: "Hello World",
  },
});
```

The exact API should be refined during implementation.

The registry must support:

- component type
- renderer
- default props
- editable properties
- children rules
- drop rules
- validation
- serialization behavior
- export behavior
- metadata

---

# 14. Component Definition

A component definition should be declarative wherever possible.

Example:

```text
Hero
├── type: hero
├── accepts:
│   ├── text
│   ├── button
│   └── image
├── props:
│   ├── title
│   ├── description
│   └── alignment
└── renderer
```

This enables the editor to understand the component without requiring developers to implement editor behavior manually.

---

# 15. Component Categories

Eugine should support:

### Primitive components

- div
- section
- span
- text
- image
- button

### Layout components

- container
- grid
- flex
- stack
- columns

### Application components

- navbar
- modal
- form
- table
- card

### Custom components

Anything the developer registers.

---

# 16. Component Extensibility

Developers should be able to provide their own component implementations.

Potential integrations include:

- shadcn/ui
- Radix
- Tailwind
- CSS Modules
- CSS-in-JS
- styled-components
- Emotion
- custom CSS
- design-system components

Eugine should **not** require Tailwind.

Tailwind should be one possible styling strategy.

---

# 17. Styling Architecture

Styling must remain independent from Eugine's core.

The node model may store:

```text
className
style
attributes
custom style metadata
```

but Eugine should not assume how those values are ultimately interpreted.

This allows:

```text
Tailwind
      ↓
className

CSS-in-JS
      ↓
generated class

styled-components
      ↓
component styles

Plain CSS
      ↓
className / style
```

---

# 18. Tailwind Integration

Eugine should provide optional utilities for Tailwind users.

Example:

```javascript
node.setProps({
  className: "flex items-center justify-between p-6",
});
```

However, Eugine should not bundle Tailwind itself.

This preserves the lightweight architecture.

---

# 19. Styled Component Integration

Developers should be able to create:

```javascript
const MyButton = styled.button`
  ...
`;
```

and register the component with Eugine.

Eugine should treat the registered component as an external renderer.

The core should not need to know how the styling library generates CSS.

---

# 20. Drag-and-Drop Engine

Core drag-and-drop functionality must support:

- dragging new components
- moving existing components
- nested components
- reordering
- drop indicators
- insertion positions
- valid/invalid drop states
- drag cancellation
- keyboard-accessible movement where practical

---

# 21. Drop Rules

Components must be able to define placement rules.

Examples:

```text
Container
├── accepts: *
```

```text
Text
├── accepts: none
```

```text
Grid
├── accepts: block
└── maxChildren: 12
```

This prevents invalid component structures.

---

# 22. Selection System

Users should be able to:

- select node
- deselect
- multi-select where supported
- select parent
- select child
- inspect node
- focus node
- delete node

The editor should expose selection events.

Example:

```text
onSelect
onDeselect
onSelectionChange
```

---

# 23. Canvas

Eugine should provide a canvas abstraction rather than forcing one visual implementation.

The canvas must support:

- rendering document
- selection overlay
- drop indicators
- drag interaction
- hover state
- insertion markers
- zoom
- viewport
- responsive preview

---

# 24. Undo / Redo

Undo/redo is a core feature.

The history system should track document mutations.

Example:

```text
Initial
 ↓
Add Section
 ↓
Add Heading
 ↓
Change Heading
 ↓
Move Button
```

Undo:

```text
Move Button
→ Change Heading
→ Add Heading
```

Redo restores forward changes.

---

# 25. History Architecture

History should be command-oriented rather than storing unlimited full document copies whenever possible.

Conceptually:

```text
Command
├── execute()
├── undo()
├── metadata
└── timestamp
```

This allows future optimization.

However, the implementation may use immutable snapshots or patches where benchmarks demonstrate that they are more appropriate.

---

# 26. History API

Developers should be able to:

```javascript
editor.history.undo();
editor.history.redo();
editor.history.canUndo();
editor.history.canRedo();
```

and subscribe to:

```javascript
editor.history.onChange(...)
```

---

# 27. History Callbacks

The system should emit lifecycle events such as:

```text
beforeChange
change
afterChange
undo
redo
batchStart
batchEnd
```

This allows external applications to:

- autosave
- update UI
- synchronize collaboration
- trigger analytics

---

# 28. Transaction / Batch System

Multiple operations should be grouped into a single history transaction.

Example:

```text
User drags a component
```

Internally:

```text
removeFromOldParent
insertIntoNewParent
updatePosition
updateSelection
```

should become:

> **One Undo operation**

not four.

---

# 29. Commands

Eugine should expose a command abstraction.

Commands include:

- insert
- delete
- move
- duplicate
- update props
- update styles
- wrap
- unwrap
- replace
- reorder

This provides a stable foundation for:

- history
- collaboration
- keyboard shortcuts
- plugins

---

# 30. Events

Eugine should expose a centralized event system.

Examples:

```text
editor.ready
document.change
node.create
node.delete
node.move
node.select
node.update
history.undo
history.redo
component.register
component.unregister
```

Events should provide structured payloads.

---

# 31. Serialization

Eugine must provide a canonical JSON representation.

The JSON must contain everything necessary to reconstruct the editable document.

Example:

```javascript
const json = editor.serialize();
```

and:

```javascript
editor.load(json);
```

The serialized document should be:

- deterministic
- versioned
- schema-validatable
- migration-friendly

---

# 32. Versioned Document Format

Every document should contain a schema version.

Example:

```json
{
  "schemaVersion": 1,
  "engine": "eugine",
  "document": {}
}
```

This allows future migrations.

For example:

```text
Schema v1
   ↓
Migration
   ↓
Schema v2
```

Old documents should not automatically break when Eugine evolves.

---

# 33. JSON Security / Protected Documents

The user requested the ability to make JSON compressed and protected.

This must be separated into three concepts:

### Compression

Reduce size.

### Encoding

Convert data into another representation.

### Encryption

Protect confidentiality.

Base64 or minification **does not provide security**.

Therefore, Eugine should never describe compressed/encoded JSON as “secure.”

---

# 34. Secure Document Format

Future versions may support:

```text
Document JSON
     ↓
Canonicalization
     ↓
Compression
     ↓
Encryption
     ↓
Protected Payload
```

Encryption should be implemented through well-established cryptographic primitives rather than custom encryption algorithms.

The encryption layer should remain optional because many users simply need compact storage.

---

# 35. Export System

Eugine should support multiple export formats.

### JSON

Canonical editable document.

### HTML

Static rendered HTML.

### HTML + CSS

Rendered page plus styles.

### Custom Export

Plugin-defined format.

---

# 36. HTML Export

Example:

```javascript
const html = editor.export({
  format: "html",
});
```

The exporter should produce deterministic output.

The exported HTML should not depend on the editor being present.

---

# 37. Renderer Architecture

The renderer should be independent of the editor.

Conceptually:

```text
Document
   ↓
Renderer
   ↓
Output
```

Possible renderers:

```text
DOM Renderer
React Renderer
Server Renderer
HTML Renderer
Custom Renderer
```

---

# 38. Server-Side Rendering

SSR is a first-class architectural requirement.

The user should be able to:

```text
API
 ↓
Eugine JSON
 ↓
Server Renderer
 ↓
HTML
```

without loading the visual editor.

This distinction is critical:

> **Editor Runtime ≠ Renderer Runtime**

The editor requires browser capabilities.

The renderer should not.

---

# 39. Next.js Integration

Eugine should support a Next.js architecture such as:

```text
Next.js Server Component
        ↓
Fetch Eugine JSON
        ↓
Eugine Server Renderer
        ↓
HTML
        ↓
Browser
        ↓
Optional client hydration
```

Next.js currently supports fetching data directly from Server Components and rendering the result on the server.

Therefore Eugine's server-rendering package should avoid requiring:

- window
- document
- localStorage
- browser drag-and-drop APIs
- editor state
- DOM measurement

during server rendering.

---

# 40. Recommended Package Architecture

The project should be designed as a package family rather than one enormous package.

Potential structure:

```text
eugine
eugine-core
eugine-renderer
eugine-renderer-react
eugine-renderer-server
eugine-plugin-history
eugine-plugin-collaboration
eugine-plugin-tailwind
eugine-plugin-assets
eugine-plugin-...
```

The exact package names should be validated before publication because npm names must be unique.

npm packages are distributed through the npm registry and are installable by package name. npm also recommends semantic versioning for published packages, particularly because breaking changes should increment the major version.

---

# 41. Core Package Principle

The base package should remain as small as practical.

The following should **not** automatically become mandatory dependencies:

- React
- Tailwind
- styled-components
- collaboration SDK
- WebSocket library
- database client
- UI library

Eugine should use optional integrations.

---

# 42. Plugin Architecture

Plugins are essential to Eugine.

A plugin should be able to:

- register components
- register commands
- register events
- add history behavior
- add serializers
- add renderers
- add storage
- extend editor APIs
- add keyboard shortcuts
- add panels
- modify behavior

Conceptually:

```javascript
editor.use(plugin);
```

---

# 43. Plugin Lifecycle

Plugins should support lifecycle hooks:

```text
install
initialize
ready
destroy
```

Potential future hooks:

```text
beforeSerialize
afterSerialize
beforeLoad
afterLoad
```

---

# 44. Storage Adapter

Eugine should not assume where projects are stored.

Storage should be pluggable.

Possible adapters:

- memory
- localStorage
- IndexedDB
- REST API
- GraphQL
- database-backed API
- custom storage

Example:

```javascript
editor.storage.use({
  save: async (document) => {},
  load: async (id) => {},
});
```

---

# 45. Autosave

Autosave should be implemented through the storage/event system rather than tightly coupled to the editor.

Example:

```text
Document Change
 ↓
Debounce
 ↓
Storage Adapter
 ↓
API
```

Developers should control:

- debounce duration
- save conditions
- retry behavior
- conflict handling

---

# 46. Collaboration Architecture

Real-time collaboration should be an optional module rather than part of core.

The collaboration system should support:

- multiple users
- live changes
- presence
- cursors
- selections
- document synchronization
- conflict resolution

---

# 47. Collaboration Model

Do not synchronize entire JSON documents on every change.

Instead:

```text
User Action
 ↓
Command / Operation
 ↓
Operation Serialization
 ↓
Transport
 ↓
Remote Client
 ↓
Apply Operation
```

Potential future implementations may use CRDT or operational transformation approaches.

The exact synchronization algorithm should be selected after benchmarking the expected document size and collaboration requirements.

---

# 48. Collaboration Presence

Optional collaboration UI should support:

```text
James
Sarah
Michael
```

with:

- active users
- selected nodes
- cursor position
- editing indicators

Presence should be separate from document state.

---

# 49. Conflict Resolution

The system must assume concurrent edits can happen.

Example:

```text
User A changes heading text
User B changes heading style
```

Both changes should be merged where possible.

The collaboration layer must not simply overwrite the entire document with the latest JSON snapshot.

---

# 50. Component Locking

Components should optionally support:

```text
editable
readOnly
locked
hidden
```

This is useful for:

- CMS templates
- design systems
- reusable components

Example:

```text
Header
├── locked
└── cannot be deleted

Content
└── editable
```

---

# 51. Responsive Editing

The editor should support responsive breakpoints.

Conceptually:

```text
Desktop
Tablet
Mobile
```

A component may have responsive properties.

Example:

```json
{
  "style": {
    "desktop": {
      "padding": "32px"
    },
    "mobile": {
      "padding": "16px"
    }
  }
}
```

The exact style representation should remain framework-neutral.

---

# 52. Device Preview

Developers should be able to implement:

```text
Desktop
Tablet
Mobile
Custom
```

viewport previews using Eugine's canvas API.

---

# 53. Keyboard Accessibility

Core interactions should support keyboard operations where feasible:

- delete
- duplicate
- undo
- redo
- escape
- navigation
- selection

Keyboard shortcuts must be configurable.

---

# 54. Accessibility

Eugine itself should not introduce unnecessary accessibility barriers.

The engine should expose semantic information required by custom editor UIs.

The developer remains responsible for the accessibility of their custom panels and components, but Eugine should provide the necessary hooks.

---

# 55. Component Tree Navigation

The engine should expose a tree representation to build:

- Layers panel
- Navigator
- Outline
- Breadcrumb
- Inspector

Example:

```text
Page
├── Header
├── Hero
│   ├── Heading
│   ├── Paragraph
│   └── Button
├── Features
└── Footer
```

---

# 56. Property Inspector API

Eugine should provide metadata allowing developers to build property panels.

Example:

```text
Button
├── text
├── href
├── variant
├── size
└── disabled
```

The UI itself should remain developer-controlled.

---

# 57. Dynamic Data

Future versions should support data bindings.

Example:

```text
Text
    ↓
{{ user.name }}
```

or:

```text
Image
    ↓
{{ product.image }}
```

The document should store the binding rather than the current resolved value.

---

# 58. Server Data Rendering

The server renderer should eventually support:

```text
Document
+
Data Context
       ↓
Server Renderer
       ↓
HTML
```

Example:

```javascript
render(document, {
  user: {
    name: "James",
  },
});
```

This enables CMS and SaaS applications.

---

# 59. Security Boundary

Eugine must never execute arbitrary serialized document code merely because it exists in a JSON file.

Documents should be treated as data.

Potentially dangerous capabilities such as:

- arbitrary JavaScript
- arbitrary HTML
- event handler injection
- unsafe URLs

must be explicitly controlled by the host application.

---

# 60. Plugin Security

Plugins are executable code and therefore trusted dependencies.

The documentation should clearly explain:

> Installing a Eugine plugin gives that plugin code execution privileges in the host application.

The core should not provide a false security boundary around npm dependencies.

---

# 61. Server Renderer Security

The server renderer must avoid executing untrusted arbitrary code from a document.

For example:

```json
{
  "type": "custom",
  "component": "some-arbitrary-module"
}
```

must not dynamically import arbitrary modules based solely on untrusted JSON.

Instead:

```text
Allowed Component Registry
        ↓
Document references registered type
        ↓
Renderer resolves registered component
```

This is a critical requirement.

---

# 62. Component Registry as Security Boundary

The renderer should resolve:

```text
"hero"
```

against:

```javascript
registry.get("hero");
```

rather than:

```javascript
import(document.component);
```

This prevents arbitrary module loading.

---

# 63. HTML Sanitization

When exporting/rendering user-provided content:

- sanitize unsafe HTML where appropriate
- restrict dangerous attributes
- restrict javascript URLs
- prevent script injection
- clearly separate trusted custom components from user-generated content

---

# 64. Performance Goals

Eugine should be lightweight.

The initial engine should target:

- minimal runtime overhead
- tree updates without unnecessary full-document rerenders
- lazy plugin loading
- optional feature packages
- efficient history
- efficient serialization

---

# 65. Rendering Performance

Updating:

```text
One Button
```

should not require rerendering:

```text
Entire 2,000-node document
```

The architecture should support localized updates.

---

# 66. Large Document Support

The system should be designed to support documents containing:

- hundreds of nodes
- thousands of nodes

without catastrophic performance degradation.

Benchmark targets should be established during implementation.

---

# 67. Bundle Size

The project should establish explicit bundle budgets.

Suggested initial targets:

```text
Core:
< 20 KB gzip target

Core + basic editor runtime:
< 50 KB gzip target
```

These are **engineering targets**, not absolute requirements, and should be validated through real benchmarks.

---

# 68. Framework Compatibility

The core should avoid hard dependency on React.

Potential integration layers:

```text
Eugine Core
├── React Adapter
├── Vue Adapter
├── Svelte Adapter
├── Vanilla DOM Adapter
└── Future adapters
```

React should be the first-class adapter if that best matches the initial developer audience, but the document engine should remain framework-independent.

---

# 69. React Integration

React integration should provide:

- React component registration
- React renderer
- hooks
- editor provider
- component wrappers
- server-compatible rendering where possible

Potential APIs:

```javascript
<EugineProvider editor={editor}>
  <EditorCanvas />
</EugineProvider>
```

and:

```javascript
const node = useEugineNode();
```

Exact API design should be finalized during the technical design phase.

---

# 70. Next.js Integration Package

A dedicated integration package may eventually provide:

```text
eugine/next
```

or a separate package.

Responsibilities:

- Server rendering
- RSC-compatible patterns
- client editor boundary
- document loading
- cache/revalidation helpers
- static export utilities

Next.js explicitly recommends using Server Components for server-side data fetching and rendering, while interactive browser functionality should be placed behind Client Component boundaries.

---

# 71. Important SSR Constraint

The following must never be imported into the server renderer:

```text
window
document
HTMLElement
localStorage
ResizeObserver
PointerEvent-dependent editor code
```

Browser-specific behavior belongs to the editor runtime.

---

# 72. Server Renderer Contract

The renderer should have a simple conceptual contract:

```javascript
const html = renderDocument(document, {
  registry,
  data,
  options,
});
```

It must be deterministic for identical inputs.

---

# 73. HTML Hydration Strategy

Eugine should not require hydration merely to display a published page.

There should be two modes:

### Static Output

```text
JSON
→ HTML
```

No editor runtime.

### Interactive Output

```text
JSON
→ HTML
→ client runtime
→ interactions
```

This allows the host application to decide how much JavaScript is necessary.

---

# 74. Publishing Model

A host application should be able to have:

```text
Draft
 ↓
Save
 ↓
Preview
 ↓
Publish
 ↓
Published Document
```

Published documents should be immutable/versioned where appropriate.

---

# 75. Document Versioning

Support:

```text
Draft v12
Published v10
```

A host application should be able to roll back to an earlier document version.

Version management itself should remain outside the core unless a dedicated plugin provides it.

---

# 76. Migration System

When the document schema changes:

```text
v1
 ↓
migration
 ↓
v2
```

Migrations must be deterministic and testable.

Example:

```javascript
migrate(document, {
  from: 1,
  to: 2,
});
```

---

# 77. Developer Experience

Eugine should aim for a developer experience where a basic editor can be created with minimal code.

Conceptual example:

```javascript
import { createEditor } from "eugine"

const editor = createEditor({
  components: {
    ...
  }
})
```

Then:

```javascript
editor.load(document);
```

and:

```javascript
editor.serialize();
```

The exact API should prioritize discoverability and consistency.

---

# 78. API Design Principles

Public APIs should:

- use predictable naming
- avoid excessive abstraction
- provide TypeScript definitions
- have clear return types
- avoid hidden global state
- support tree-shaking
- avoid magic behavior
- provide useful error messages

---

# 79. TypeScript

Although Eugine is described as a JavaScript library, implementation should strongly consider **TypeScript internally**.

The package should provide excellent TypeScript declarations.

This provides:

- better developer experience
- stronger plugin APIs
- component metadata typing
- document schema typing
- autocomplete
- safer integrations

JavaScript users should still be able to install and use it normally.

---

# 80. Package Distribution

The package should be published through npm.

npm's registry is designed for discovering and installing JavaScript packages, and a package requires a `package.json` to be published.

The project should provide:

```text
npm install eugine
```

subject to the final availability of the package name.

---

# 81. Package Exports

The package should expose explicit entry points.

Conceptually:

```text
eugine
eugine/core
eugine/react
eugine/server
eugine/plugins/*
```

This allows users to import only what they need.

---

# 82. ESM / CommonJS

The package should prioritize modern ESM.

If compatibility requirements justify it, a CommonJS build can be provided.

The package exports must be explicitly defined rather than relying on ambiguous module resolution.

---

# 83. Tree Shaking

Optional functionality must be tree-shakeable.

A developer who only uses:

```text
core + renderer
```

should not automatically receive:

```text
collaboration
asset manager
AI
```

---

# 84. npm Publishing

The release pipeline should include:

1. Build
2. Type checking
3. Unit tests
4. Integration tests
5. Bundle-size validation
6. Package validation
7. npm pack verification
8. Publish
9. Release notes

npm explicitly provides `npm pack --dry-run` for checking package contents before publishing, and recommends testing the package installation before publishing.

---

# 85. Semantic Versioning

Eugine must follow SemVer.

```text
MAJOR
Breaking API/schema changes

MINOR
Backward-compatible features

PATCH
Bug fixes
```

npm recommends semantic versioning for published packages and specifically recommends major version increments for breaking dependency/API changes.

---

# 86. Documentation

Documentation is a critical part of the product.

It should include:

### Getting Started

- installation
- first editor
- first component
- first document

### Concepts

- document model
- nodes
- components
- renderer
- commands
- history
- plugins

### API

Complete API reference.

### Guides

- Tailwind
- styled-components
- shadcn
- Next.js
- SSR
- storage
- collaboration

### Advanced

- custom renderer
- custom commands
- custom history
- plugin development
- document migrations

---

# 87. Example Documentation Structure

```text
Introduction
├── What is Eugine?
├── Why Eugine?
└── Architecture

Getting Started
├── Installation
├── Create an Editor
├── Register Components
└── Save a Document

Core Concepts
├── Nodes
├── Components
├── Commands
├── Events
├── History
├── Serialization
└── Rendering

Integrations
├── React
├── Next.js
├── Tailwind
├── styled-components
└── shadcn

Advanced
├── Plugins
├── Custom Renderers
├── SSR
├── Storage
├── Collaboration
└── Security
```

---

# 88. Testing Strategy

The project must have multiple testing layers.

## Unit tests

Test:

- document tree
- node operations
- history
- commands
- serialization
- migrations
- registry

## Integration tests

Test:

- drag-and-drop
- editor interactions
- component registration
- renderer
- storage

## SSR tests

Test:

- server rendering
- Next.js integration
- absence of browser APIs
- deterministic output

## Compatibility tests

Test:

- React versions
- Node versions
- browser environments

---

# 89. Property-Based Testing

The document model should eventually use property-based tests for invariants such as:

```text
serialize(load(document))
≈ normalized(document)
```

and:

```text
undo(redo(state))
```

should preserve expected state.

This is particularly valuable for a complex editor engine.

---

# 90. Critical Invariants

The following must always hold:

### Tree integrity

A node cannot have multiple parents.

### ID uniqueness

Every node ID must be unique within the document.

### Serialization integrity

A serialized document must be loadable.

### History integrity

Undo/redo must not corrupt the tree.

### Registry integrity

Unknown component types must fail gracefully.

### Renderer integrity

A valid document must produce deterministic output.

---

# 91. Error Handling

Errors should be categorized.

Example:

```text
EUGINE_DOCUMENT_INVALID
EUGINE_NODE_NOT_FOUND
EUGINE_COMPONENT_NOT_REGISTERED
EUGINE_INVALID_DROP
EUGINE_SERIALIZATION_FAILED
EUGINE_RENDER_FAILED
EUGINE_PLUGIN_ERROR
```

Errors should include:

- code
- message
- context
- optional cause

---

# 92. Developer Debugging

Development mode should optionally expose:

```text
Document inspector
Node tree
History stack
Registered components
Plugin list
Event log
Render diagnostics
```

This can dramatically reduce integration difficulty.

---

# 93. Devtools

A future dedicated Eugine DevTools extension could provide:

```text
Components
Layers
State
History
Events
Performance
```

This should be considered a future product opportunity.

---

# 94. Accessibility of the Editor

The editor UI is ultimately host-controlled, but Eugine should expose:

- selected node state
- focus state
- keyboard actions
- node labels
- component metadata

so developers can create accessible editor interfaces.

---

# 95. Internationalization

The core should avoid hardcoded user-facing strings.

Editor UI integrations should be able to provide translations.

The engine should remain locale-independent.

---

# 96. Localization of Component Metadata

Component definitions may contain:

```text
label
description
category
```

These should support localized values or translation keys.

---

# 97. Plugin Ecosystem

Eventually Eugine should have a plugin ecosystem.

Potential official plugins:

```text
@eugine/history
@eugine/react
@eugine/server
@eugine/tailwind
@eugine/assets
@eugine/collaboration
@eugine/commands
@eugine/storage
```

Exact package naming should be determined after npm namespace/name validation.

---

# 98. Official Component Library

A separate package should eventually provide optional components:

```text
Button
Card
Container
Grid
Stack
Image
Text
Heading
Section
Form
Input
Navbar
Footer
```

This should not be included in core.

---

# 99. shadcn Integration Strategy

Eugine should not attempt to become another shadcn-style component repository.

Instead:

```text
Developer's shadcn components
             ↓
       Eugine Registry
             ↓
         Editor
```

The developer remains the owner of the component implementation.

This makes Eugine compatible with existing design systems.

---

# 100. Design Token Integration

Future APIs should support:

```text
Colors
Spacing
Typography
Radius
Shadows
Breakpoints
```

A host application could expose its own design tokens to the property panel.

---

# 101. Theming

Eugine should not force a theme.

Editor UIs can be styled independently.

The engine should provide state information, not a visual design system.

---

# 102. Templates

Templates should be represented as normal Eugine documents.

Example:

```text
Template
↓
Document JSON
↓
Insert into current document
```

This means templates automatically benefit from:

- versioning
- serialization
- rendering
- migrations

---

# 103. Reusable Components

Future versions should support reusable symbols/components.

Example:

```text
Global Navbar
```

Changing the source could optionally update every instance.

This should be implemented as a higher-level feature rather than complicating the initial node model.

---

# 104. Copy / Paste

Users should be able to copy nodes.

The system should:

- preserve structure
- regenerate conflicting IDs
- preserve component types
- optionally preserve styles
- optionally preserve references

---

# 105. Duplicate

Duplicate should create a deep copy of a node subtree with new IDs.

It must create one history transaction.

---

# 106. Import

The platform may eventually support importing:

- Eugine JSON
- HTML
- predefined templates

HTML import should be treated as a conversion process, not as a canonical document format.

This aligns with the architectural lesson from existing builders that editable project JSON should remain the canonical persistence format.

---

# 107. HTML-to-Eugine Conversion

Future functionality:

```text
HTML
 ↓
Parser
 ↓
Eugine Nodes
```

The converter must clearly document that arbitrary HTML cannot always map perfectly to editable component semantics.

---

# 108. CSS Handling

CSS should remain external where possible.

Potential document approaches:

```text
className
style
styleTokens
```

Avoid creating an unnecessarily complex CSS engine in core.

---

# 109. Asset Management

Asset management should be an optional module.

It may provide:

- image uploads
- asset URLs
- asset metadata
- image selection
- remote assets
- CDN integration

Eugine core should not require a storage provider.

---

# 110. Forms

Future component metadata should allow form-related components.

Example:

```text
Input
├── name
├── type
├── placeholder
├── required
└── validation
```

The editor itself should not become a complete form-processing framework.

---

# 111. SEO

The document model should eventually support metadata such as:

- title
- description
- canonical URL
- Open Graph data

However, this should remain application-level metadata rather than being tightly coupled to the core node tree.

---

# 112. Analytics Hooks

Eugine should expose hooks for host applications to track:

- component added
- component removed
- document saved
- export triggered
- publish triggered

The library should not send analytics automatically.

---

# 113. Telemetry

No telemetry should be enabled by default.

If telemetry is ever introduced:

- opt-in must be explicit
- documentation must be clear
- no document content should be transmitted by default

---

# 114. Offline Support

Because the document is serializable, Eugine should be compatible with offline editing.

Potential architecture:

```text
Editor
 ↓
Local Storage
 ↓
Reconnect
 ↓
Sync
```

This becomes especially useful when combined with collaboration.

---

# 115. Collaboration + Offline Future

A future collaboration system could provide:

```text
Local document
      ↓
Local operations
      ↓
Sync queue
      ↓
Server
      ↓
Other clients
```

This should be considered from the document-operation architecture from the beginning, even if collaboration is not included in MVP.

---

# 116. MVP Definition

The first production-quality version should focus on the editor engine.

## MVP includes

### Core

- document model
- nodes
- tree operations
- component registry
- commands
- events
- serialization
- loading

### Editor

- canvas
- selection
- drag-and-drop
- move
- delete
- duplicate
- nesting

### History

- undo
- redo
- transactions
- history callbacks

### Renderer

- client renderer
- HTML renderer
- framework integration foundation

### Developer Experience

- TypeScript definitions
- documentation
- examples
- tests

### Distribution

- npm package
- ESM
- package exports
- semantic versioning

---

# 117. MVP Explicitly Excludes

The first release should not attempt to fully implement:

- real-time collaboration
- CRDT
- AI generation
- marketplace
- cloud storage
- authentication
- hosted builder
- asset CDN
- complete design system
- advanced CSS editor
- HTML import
- visual CSS designer

These should be future extensions.

---

# 118. Phase 2

Phase 2 should add:

- React renderer
- server renderer
- Next.js integration
- storage adapters
- responsive editing
- keyboard shortcuts
- reusable templates
- asset plugin
- Tailwind integration
- stronger debugging tools

---

# 119. Phase 3

Phase 3:

- collaboration
- presence
- real-time synchronization
- comments
- shared editing
- versioning
- offline mode

---

# 120. Phase 4

Potential advanced features:

- AI assistant
- AI component generation
- HTML import
- design-to-code
- advanced design tokens
- visual CSS editor
- component marketplace
- hosted cloud service

---

# 121. AI Integration Future

AI should eventually operate on the document model rather than manipulating arbitrary DOM.

Example:

User:

> “Add a three-column feature section.”

AI:

```text
Command
 ↓
Create Section
 ↓
Create Grid
 ↓
Create 3 Cards
 ↓
Insert Icons
 ↓
Update Document
```

This makes AI actions:

- deterministic
- undoable
- inspectable
- serializable

The command system therefore provides an excellent foundation for future AI integration.

---

# 122. AI Safety

AI-generated changes should be represented as normal editor transactions.

Therefore:

```text
AI Change
 ↓
Command
 ↓
History
```

The user can:

> Undo AI change.

---

# 123. Developer Workflow

The intended workflow is:

```text
1. npm install Eugine
2. Create editor
3. Register components
4. Build custom editor UI
5. Load document
6. Allow user to edit
7. Serialize document
8. Save document
9. Render document
10. Publish
```

---

# 124. Example Application Architecture

A developer could build:

```text
My Website Builder
│
├── React
│
├── Tailwind
│
├── shadcn
│
├── Next.js
│
├── API
│
├── Database
│
└── Eugine
    ├── Editor
    ├── Document
    ├── Registry
    ├── History
    └── Renderer
```

This is the intended ecosystem.

---

# 125. Reference Implementation

The Eugine repository should contain a reference application.

Example:

> **Eugine Studio**

It should demonstrate:

- drag-and-drop
- components
- layers
- properties
- history
- serialization
- responsive preview
- Tailwind
- shadcn
- server rendering

This application is primarily a showcase and integration test.

---

# 126. Repository Structure

A recommended monorepo:

```text
eugine/
├── packages/
│   ├── core/
│   ├── renderer/
│   ├── renderer-react/
│   ├── renderer-server/
│   ├── plugin-history/
│   ├── plugin-storage/
│   ├── plugin-collaboration/
│   └── plugin-tailwind/
│
├── apps/
│   ├── docs/
│   ├── studio/
│   └── examples/
│
├── tests/
│
├── scripts/
│
├── package.json
└── README.md
```

The exact monorepo tooling can be selected during technical design.

---

# 127. Engineering Principles

Developers working on Eugine must follow these principles:

### Do not couple core to UI

### Do not couple core to a specific framework unnecessarily

### Do not store editor-only state in the persisted document

### Do not make HTML the canonical persistence format

### Do not put collaboration logic inside core

### Do not dynamically execute components from untrusted JSON

### Do not introduce large dependencies for small functionality

### Do not break the document schema without migrations

---

# 128. Editor State vs Document State

This distinction must be explicit.

## Document state

Persisted:

```text
Nodes
Props
Styles
Structure
Component references
```

## Editor state

Temporary:

```text
Selected node
Hovered node
Drag state
Viewport
Zoom
Open panels
History UI
Cursor
```

Editor state should not normally be persisted.

---

# 129. Persistence Contract

A persisted document should be sufficient to reconstruct:

```text
Document
+
Registered Components
=
Renderable Page
```

The document should not depend on:

```text
Current selection
Current viewport
Current panel state
```

---

# 130. Rendering Contract

A renderer receives:

```text
Document
+
Component Registry
+
Optional Data Context
```

and produces:

```text
UI / HTML
```

The renderer must not require:

```text
Drag-and-drop
History
Selection
Editor panels
```

---

# 131. Core Success Metrics

The primary product metrics should focus on developer adoption.

### Installation

- npm downloads
- unique dependent projects

### Activation

Number of developers who:

1. install Eugine
2. create an editor
3. register a component
4. serialize a document

### Retention

Projects still using Eugine after:

- 7 days
- 30 days
- 90 days

### Ecosystem

- plugins
- integrations
- GitHub projects
- community contributions

### Technical

- bundle size
- editor initialization time
- document update latency
- render performance
- serialization performance

---

# 132. Quality Gates

A release should not be published unless:

- unit tests pass
- integration tests pass
- type checking passes
- lint passes
- build passes
- SSR tests pass
- package exports are validated
- npm package contents are inspected
- documentation builds
- bundle-size budget is checked
- migration tests pass

---

# 133. Release Strategy

Use:

```text
0.x
```

while the API is still evolving.

Once the core architecture is stable:

```text
1.0.0
```

should represent a commitment to a stable public API.

After 1.0:

```text
Major = breaking
Minor = feature
Patch = fix
```

---

# 134. Backwards Compatibility

Public APIs must be considered stable once released.

Breaking changes should:

- be documented
- have migration guides
- include codemods where practical
- include schema migrations when necessary
- increment major version

---

# 135. Open Architecture Decisions

Before implementation begins, the engineering team must explicitly decide:

1. What framework(s) does the first renderer support?
2. Is React a dependency of core or only an adapter?
3. What exact document schema is used?
4. Immutable state or mutable model?
5. Patch-based or snapshot-based history?
6. Which drag-and-drop implementation?
7. How are styles represented?
8. How are component props validated?
9. How are dynamic components represented?
10. How will server rendering work?
11. How will custom components be registered for SSR?
12. How will collaboration operations be represented?
13. Should core support DOM directly?
14. Which browsers are supported?
15. What is the minimum Node.js version?
16. What are the exact bundle-size budgets?

These decisions should be documented in separate technical design documents before implementation.

---

# 136. Critical Architectural Recommendation

The project should be divided conceptually into:

```text
Eugine Core
      ↓
Document Engine
      ↓
Renderer
      ↓
Framework Adapter
      ↓
Editor UI
```

not:

```text
React Page Builder
      ↓
Everything
```

This prevents the library from becoming difficult to extend.

---

# 137. Definition of Done — Core

The core engine is complete when developers can:

- create a document
- create nodes
- register components
- insert components
- move components
- delete components
- update props
- serialize
- load
- undo
- redo
- subscribe to changes
- implement their own UI around the engine

without depending on Eugine's reference editor.

---

# 138. Definition of Done — Renderer

The renderer is complete when:

- the same document can be rendered outside the editor
- rendering does not require browser APIs
- unknown components fail predictably
- output is deterministic
- custom registered components work
- server rendering is supported

---

# 139. Definition of Done — SSR

SSR is complete when a host application can:

```text
Fetch JSON from API
        ↓
Server
        ↓
Eugine Renderer
        ↓
HTML
```

without loading the browser editor.

A Next.js App Router application should be able to fetch Eugine document data from a Server Component and render it on the server. This matches Next.js's current Server Component architecture.

---

# 140. Definition of Done — Collaboration

Collaboration is complete when:

- two users can edit simultaneously
- changes propagate
- concurrent changes do not corrupt the document
- presence works
- users can identify other users
- offline/reconnect behavior is defined
- collaboration can be enabled without modifying core document APIs

---

# 141. Final Product Architecture

The long-term Eugine ecosystem should look like:

```text
                         EUGINE
                           │
          ┌────────────────┼────────────────┐
          │                │                │
        CORE            RENDERERS         PLUGINS
          │                │                │
     Document          React             History
     Commands          DOM               Storage
     Events            Server            Tailwind
     Registry          HTML              Assets
     History*                              Collaboration*
          │
          │
     DEVELOPER APP
          │
 ┌────────┼─────────┐
 │        │         │
Editor   CMS       SaaS
 │        │         │
Page     Content   Website
Builder  Builder   Builder
```

`*` optional modules.

---

# 142. Final Product Definition

Eugine should ultimately be understood as:

> **A lightweight, extensible JavaScript engine for building custom visual editors and page builders, centered around a serializable document model, component registry, command/history system, framework-independent rendering architecture, and optional plugin ecosystem.**

It should **not** compete by attempting to provide every feature inside the core.

Its competitive advantage should be:

> **“Build your editor your way. Eugine provides the engine.”**

A developer should be able to take Eugine and combine it with:

```text
React
Next.js
Tailwind
shadcn
styled-components
their own components
their own API
their own database
their own authentication
their own editor UI
their own design system
```

while Eugine remains responsible for the difficult underlying editor mechanics.

---

# 143. Final Product Principles

The following principles are considered mandatory for the project:

1. **Core first, UI second.**
2. **Document model is the source of truth.**
3. **JSON is the editable persistence format.**
4. **HTML is an output format, not the canonical editor state.**
5. **Rendering must be separable from editing.**
6. **SSR must not require the editor runtime.**
7. **Framework integrations must be adapters.**
8. **Plugins must extend rather than bloat core.**
9. **Components belong to the application/developer ecosystem.**
10. **Unknown/untrusted documents must never execute arbitrary code.**
11. **History must be transaction-aware.**
12. **Collaboration must synchronize operations rather than blindly replacing documents.**
13. **Document schemas must be versioned and migratable.**
14. **The package must remain lightweight.**
15. **Developer experience is a primary product feature.**
16. **Every major API must be documented and tested.**
17. **Performance must be measured rather than assumed.**
18. **No feature should unnecessarily force a specific styling library.**
19. **No feature should unnecessarily force a specific framework.**
20. **Eugine should provide infrastructure, not dictate the developer's product.**

---

# 144. Research References

The architectural research for this PRD included:

- GrapesJS component architecture and component models, including the distinction between component models and views.
- GrapesJS project persistence guidance emphasizing JSON project data as the correct source for loading/editing projects.
- npm package publishing and package distribution requirements.
- npm package testing, publishing, scoped packages and package-content validation.
- npm Semantic Versioning guidance.
- React Server Components architecture and server rendering capabilities.
- Current Next.js App Router Server/Client Component architecture.
- Current Next.js server-side data-fetching and streaming architecture.

# End of PRD
