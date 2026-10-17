/** POST JSON to one of our API routes; throws an Error with a user-facing message. */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }
  let data: { error?: string; issues?: { message: string }[] } & Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    // e.g. a platform timeout page instead of our JSON
    throw new Error(
      res.status === 504
        ? "That took too long. Please try again; repeat searches are faster."
        : "Something went wrong. Please try again.",
    );
  }
  if (!res.ok) {
    const issue = data.issues?.[0]?.message;
    throw new Error(issue ? `${data.error} ${issue}` : (data.error ?? "Something went wrong."));
  }
  return data as T;
}
