export type VersioningErrorCode =
  | "VERSIONING_NOT_INSTALLED"
  | "VERSIONING_VERSION_NOT_FOUND"
  | "VERSIONING_ADAPTER_ERROR"
  | "VERSIONING_RESTORE_FAILED";

export interface VersioningErrorOptions {
  context?: object;
  cause?: unknown;
}

/**
 * Every error this package throws is a VersioningError, mirroring
 * `@eugine/core`'s EugineError so hosts already branching on `.code`
 * elsewhere in Eugine find the same shape here — but it is deliberately a
 * separate class (`error instanceof VersioningError`, `error.name ===
 * "VersioningError"`), not a new `EugineErrorCode` variant: this package
 * doesn't modify `@eugine/core`'s closed error-code union.
 */
export class VersioningError extends Error {
  public readonly code: VersioningErrorCode;
  public readonly context?: object;

  constructor(code: VersioningErrorCode, message: string, options: VersioningErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "VersioningError";
    this.code = code;
    this.context = options.context;
  }
}
