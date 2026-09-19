export async function api<T>(path: string, value?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, value === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "The request could not be completed");
  return data as T;
}
