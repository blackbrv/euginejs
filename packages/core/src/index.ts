// Errors
export { EugineError, componentNotRegistered, invalidDocument, invalidDrop, nodeNotFound } from "./errors.js";
export type { EugineErrorCode, EugineErrorOptions } from "./errors.js";

// IDs
export { createId } from "./id.js";

// Events
export { EventBus } from "./events.js";
export type { EugineEventMap, Listener } from "./events.js";

// Types / document model
export { CURRENT_SCHEMA_VERSION } from "./types.js";
export type {
  ComponentDefinition,
  ComponentPropDefinition,
  Disposable,
  DropAcceptRule,
  EugineDocument,
  EugineNode,
  JsonValue,
  NodeProps,
  NodeStyles,
  SerializedDocument,
} from "./types.js";

// Tree operations
export {
  captureSubtree,
  createEmptyDocument,
  createNode,
  duplicateSubtree,
  getAncestors,
  getChildren,
  getNode,
  getParent,
  getRoot,
  hasNode,
  insertNode,
  isAncestor,
  moveNode,
  removeNode,
  reorderChildren,
  replaceNode,
  restoreSubtree,
  subtreeIds,
  unwrapNode,
  updateNodeProps,
  updateNodeStyles,
  validateDocument,
  walk,
  wrapNode,
} from "./tree.js";
export type { CreateNodeOptions, MoveOptions } from "./tree.js";

// Document store
export { DocumentStore } from "./document.js";
export type { DocumentStoreEvents } from "./document.js";

// Component registry
export { ComponentRegistry } from "./registry.js";
export type { DropCheckContext } from "./registry.js";

// Commands
export * from "./commands/index.js";

// History
export { History } from "./history.js";
export type { HistoryEvents, Transaction } from "./history.js";

// Selection
export { Selection } from "./selection.js";
export type { SelectionEvents } from "./selection.js";

// Serialization
export { MigrationRegistry, isSerializedDocument, loadDocument, serializeDocument } from "./serialization.js";
export type { LoadDocumentOptions, Migration } from "./serialization.js";

// Plugins
export { PluginManager } from "./plugin.js";
export type { EuginePlugin } from "./plugin.js";

// Storage
export { MemoryStorageAdapter, StorageManager, createAutosave } from "./storage.js";
export type { AutosaveOptions, StorageAdapter } from "./storage.js";

// Editor facade
export { Editor, createEditor } from "./editor.js";
export type { CreateEditorOptions, EditorEventMap, InsertOptions } from "./editor.js";
