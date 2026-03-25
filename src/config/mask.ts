export function maskWebhookUrl(value: string): string {
  if (value.length <= 10) {
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
  }

  return `${value.slice(0, 6)}***${value.slice(-4)}`;
}
