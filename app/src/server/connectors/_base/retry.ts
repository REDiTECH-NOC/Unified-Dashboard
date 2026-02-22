/**
 * Exponential backoff with jitter for transient failure retry.
 */

interface RetryOptions {
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Return true if this error is retryable */
  shouldRetry?: (error: unknown) => boolean;
  /** Called before each retry — can be used for token refresh on 401 */
  onRetry?: (attempt: number, error: unknown) => void | Promise<void>;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxRetries,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    shouldRetry,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) break;
      if (shouldRetry && !shouldRetry(error)) break;

      if (onRetry) {
        await onRetry(attempt + 1, error);
      }

      // Exponential backoff with jitter
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      const jitter = delay * 0.1 * Math.random();
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError;
}
