function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseDataCelula(value: unknown): string | null {
  if (value instanceof Date) {
    // exceljs anchors date-only cells at UTC midnight regardless of the
    // runtime's timezone (e.g. 2020-09-18 becomes 2020-09-18T00:00:00.000Z).
    // Reading it with local getters shifts the calendar date by the
    // runtime's UTC offset — off by one day in any timezone behind UTC.
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
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
    // exceljs anchors time-only cells at the fixed date 1899-12-30T00:00:00Z
    // (Excel's day-zero) plus the time-of-day fraction, in UTC. Local getters
    // would apply the runtime's historical zone offset *for that 1899 date*,
    // which in many timezones (incl. America/Sao_Paulo, pre-1914 standardization)
    // isn't even a round number of minutes — producing times like "05:53"
    // instead of "09:00".
    return `${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}`;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}
