/**
 * Thin typed wrapper around fetch for the app's own API routes.
 * Every route answers `{ data }` or `{ error: { message, fields } }` (see lib/http.ts),
 * so error handling lives here once instead of in every component.
 */
export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

type ApiEnvelope<T> = { data?: T; error?: { message?: string; fields?: Record<string, string> } };

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok) {
    throw new RequestError(
      payload?.error?.message ?? `Request failed with ${response.status}`,
      response.status,
      payload?.error?.fields,
    );
  }

  return payload?.data as T;
}

/** Serialises a filter object into a query string, skipping empty values. */
export function toQuery(params: Record<string, string | number | boolean | undefined | string[]>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === false) continue;
    search.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
