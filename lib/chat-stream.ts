// Posts to a plain-text streaming chat route (see app/api/diy-chat and
// app/api/assistant-chat) and calls onDelta with the accumulated text after
// every chunk. Resolves with the final accumulated text once the stream ends.
export async function streamChat(
  url: string,
  body: unknown,
  onDelta: (fullTextSoFar: string) => void
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = "Request failed";
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {}
    throw new Error(message);
  }

  if (!res.body) return "";

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    accumulated += decoder.decode(value, { stream: true });
    onDelta(accumulated);
  }

  return accumulated;
}
