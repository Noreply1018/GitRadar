export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (concurrency < 1) {
    throw new Error("Concurrency must be at least 1.");
  }

  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}

export interface RetryAsyncOptions {
  attempts: number;
  delayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, nextAttempt: number) => void | Promise<void>;
}

export async function retryAsync<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryAsyncOptions,
): Promise<T> {
  if (options.attempts < 1) {
    throw new Error("Retry attempts must be at least 1.");
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const hasNextAttempt = attempt < options.attempts;
      const canRetry = options.shouldRetry
        ? options.shouldRetry(error, attempt)
        : true;

      if (!hasNextAttempt || !canRetry) {
        throw error;
      }

      await options.onRetry?.(error, attempt + 1);

      if (options.delayMs && options.delayMs > 0) {
        await wait(options.delayMs);
      }
    }
  }

  throw lastError;
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
