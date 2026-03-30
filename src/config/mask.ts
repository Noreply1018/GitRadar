export function maskWebhookUrl(value: string): string {
  try {
    const url = new URL(value);
    const endpoint = `${url.origin}${url.pathname}`;

    if (!url.search && !url.hash) {
      return endpoint;
    }

    return `${endpoint}?***`;
  } catch {
    return "[masked webhook]";
  }
}

export function maskApiKey(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "[masked api key]";
  }

  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  }

  return `${trimmed.slice(0, 4)}***${trimmed.slice(-4)}`;
}
