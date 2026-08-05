function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseDataCelula(value: unknown): string | null {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;

  return null;
}

export function parseHoraCelula(value: unknown): string | null {
  if (value instanceof Date) {
    return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}
