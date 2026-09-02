/** Bound optional work without leaving the interface permanently busy. */
export function withTimeout<T>(operation: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    operation.then(
      (value) => { clearTimeout(timeout); resolve(value); },
      (error) => { clearTimeout(timeout); reject(error); },
    );
  });
}

/** The time budget covers both response headers AND reading the JSON body. */
export async function fetchJsonWithTimeout<T>(input: RequestInfo | URL, init: RequestInit, timeoutMs: number, message: string) {
  const controller = new AbortController();
  try {
    return await withTimeout((async () => {
      const response = await fetch(input, { ...init, signal: controller.signal });
      const data = await response.json().catch(() => null) as T | null;
      return { ok: response.ok, status: response.status, data };
    })(), timeoutMs, message);
  } finally {
    controller.abort();
  }
}
