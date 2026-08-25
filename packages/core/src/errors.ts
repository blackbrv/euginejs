export type EugineErrorCode =
  | "EUGINE_DOCUMENT_INVALID"
  | "EUGINE_NODE_NOT_FOUND"
  | "EUGINE_COMPONENT_NOT_REGISTERED"
  | "EUGINE_COMPONENT_ALREADY_REGISTERED"
  | "EUGINE_INVALID_DROP"
  | "EUGINE_SERIALIZATION_FAILED"
  | "EUGINE_MIGRATION_FAILED"
  | "EUGINE_RENDER_FAILED"
  | "EUGINE_PLUGIN_ERROR"
  | "EUGINE_HISTORY_ERROR";

export interface EugineErrorOptions {
  context?: object;
  cause?: unknown;
}

/**
 * All errors thrown by Eugine's public APIs are instances of EugineError so
 * host applications can reliably branch on `error.code`.
 */
export class EugineError extends Error {
  public readonly code: EugineErrorCode;
  public readonly context?: object;

  constructor(code: EugineErrorCode, message: string, options: EugineErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "EugineError";
    this.code = code;
    this.context = options.context;
  }
}

export function invalidDocument(message: string, context?: object): EugineError {
  return new EugineError("EUGINE_DOCUMENT_INVALID", message, { context });
}

export function nodeNotFound(id: string): EugineError {
  return new EugineError("EUGINE_NODE_NOT_FOUND", `Node "${id}" was not found in the document.`, {
    context: { id },
  });
}

export function componentNotRegistered(type: string): EugineError {
  return new EugineError(
    "EUGINE_COMPONENT_NOT_REGISTERED",
    `Component type "${type}" is not registered. Register it with editor.registerComponent() before using it.`,
    { context: { type } },
  );
}

export function invalidDrop(message: string, context?: object): EugineError {
  return new EugineError("EUGINE_INVALID_DROP", message, { context });
}
