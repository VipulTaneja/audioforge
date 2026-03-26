export function getBrowserTimeZone(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatBrowserDateTime(
  value: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const timeZone = getBrowserTimeZone();

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    ...(timeZone ? { timeZone } : {}),
    ...options,
  }).format(new Date(value));
}
