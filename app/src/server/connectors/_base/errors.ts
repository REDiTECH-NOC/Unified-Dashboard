/**
 * Typed error classes for connector failures.
 * Each carries the toolId for tracing which integration failed.
 */

export class ConnectorError extends Error {
  constructor(
    public readonly toolId: string,
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string
  ) {
    super(`[${toolId}] ${message}`);
    this.name = "ConnectorError";
  }
}

export class ConnectorAuthError extends ConnectorError {
  constructor(toolId: string, message = "Authentication failed") {
    super(toolId, message, 401);
    this.name = "ConnectorAuthError";
  }
}

export class ConnectorRateLimitError extends ConnectorError {
  constructor(
    toolId: string,
    public readonly retryAfterMs?: number
  ) {
    super(
      toolId,
      `Rate limit exceeded${retryAfterMs ? ` (retry after ${retryAfterMs}ms)` : ""}`,
      429
    );
    this.name = "ConnectorRateLimitError";
  }
}

export class ConnectorNotConfiguredError extends ConnectorError {
  constructor(toolId: string) {
    super(
      toolId,
      `Integration "${toolId}" is not configured. Set up credentials in Settings > Integrations.`
    );
    this.name = "ConnectorNotConfiguredError";
  }
}
