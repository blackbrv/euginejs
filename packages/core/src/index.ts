// Errors
export { EugineError, componentNotRegistered, invalidDocument, invalidDrop, nodeNotFound } from "./errors.js";
export type { EugineErrorCode, EugineErrorOptions } from "./errors.js";

// IDs
export { createId } from "./id.js";

// Events
export { EventBus } from "./events.js";
export type { EugineEventMap, EventBusOptions, Listener, ListenerErrorHandler } from "./events.js";

// Types / document model
export { CURRENT_SCHEMA_VERSION, documentRevision } from "./types.js";
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
  cloneSubtreeSnapshot,
  createEmptyDocument,
  createNode,
  duplicateSubtree,
  invertPatch,
  reconcileOrder,
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
export type {
  CreateNodeOptions,
  IdFactory,
  MoveOptions,
  ReorderOptions,
  RestoreSubtreeOptions,
  SubtreeSnapshot,
  UpdateNodeDataOptions,
} from "./tree.js";

// Document store
export { DocumentStore } from "./document.js";
export type { ChangeOrigin, DocumentStoreEvents, SetDocumentOptions } from "./document.js";

// Operations — the serializable wire format for collaboration
export { applyOperation, applyOperations, isEugineOperation } from "./operations.js";
export type {
  ApplyOperationOptions,
  ApplyOperationsResult,
  EugineOperation,
  EugineOperationType,
  OperationConflictPolicy,
} from "./operations.js";

// Component registry
export { ComponentRegistry } from "./registry.js";
export type { DropCheckContext } from "./registry.js";

// Commands
export * from "./commands/index.js";

// History
export { History, transactionToOperations } from "./history.js";
export type { HistoryEvents, HistoryOptions, Transaction } from "./history.js";

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
export type { AutosaveHandle, AutosaveOptions, SaveOptions, SaveResult, StorageAdapter } from "./storage.js";

// Editor facade
export { Editor, createEditor } from "./editor.js";
export type {
  ApplyRemoteOptions,
  ApplyRemoteResult,
  CreateEditorOptions,
  EditorEventMap,
  InsertOptions,
} from "./editor.js";
