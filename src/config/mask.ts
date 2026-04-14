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
