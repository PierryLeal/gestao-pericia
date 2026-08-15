function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// A month-before-day display format ("m/d/yy", "mm/dd/yyyy") — the signature
// left behind when a cell was typed or copied under a US-locale Excel
// session instead of the sheet's normal Brazilian (day-first) convention.
const NUMFMT_MES_ANTES_DO_DIA = /^m+\/d+\/y+$/i;

export function parseDataCelula(value: unknown, numFmt?: string | null): string | null {
  if (value instanceof Date) {
    // exceljs anchors date-only cells at UTC midnight regardless of the
    // runtime's timezone (e.g. 2020-09-18 becomes 2020-09-18T00:00:00.000Z).
    // Reading it with local getters shifts the calendar date by the
    // runtime's UTC offset — off by one day in any timezone behind UTC.
    const ano = value.getUTCFullYear();
    let mes = value.getUTCMonth() + 1;
    let dia = value.getUTCDate();
    // Confirmed against a real sheet (TESTE all.xlsx, row 2220): a cell typed
    // as "7/11/2023" meaning 7 de novembro, under a US-locale Excel session,
    // gets stored as July 11th instead — and, because the cell's own display
    // format is month-first, it still *renders* as "7/11/23" in Excel,
    // leaving no visual trace of the swap. Reversing day/month for exactly
    // these cells recovers the original, correctly Brazilian-ordered value.
    // Only valid (and only applied) when the reversal itself produces an
    // in-range month — day > 12 has no ambiguity to begin with (Excel could
    // only have stored that exact value, from either locale).
    if (numFmt && dia <= 12 && NUMFMT_MES_ANTES_DO_DIA.test(numFmt.trim())) {
      [dia, mes] = [mes, dia];
    }
    return `${ano}-${pad2(mes)}-${pad2(dia)}`;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // D/M/YYYY or DD/MM/YYYY — day and month typed with or without a leading zero.
  const brMatchAnoCompleto = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatchAnoCompleto) {
    const [, dia, mes, ano] = brMatchAnoCompleto;
    return `${ano}-${pad2(Number(mes))}-${pad2(Number(dia))}`;
  }

  // D/M/YY or DD/MM/YY — the sheet's real-world dominant format: cells typed by
  // hand instead of picked from a date field, almost always with a 2-digit year
  // and no leading zero on day/month (e.g. "14/6/22"). Without this, over half
  // the rows in a real import (1289 of 2391 date cells, confirmed against
  // TESTE.xlsx) silently lose their data_agendada — the pericia still gets
  // created (per the "never reject a row" policy) but with no date, and two
  // rows that only differ by date then collide on the duplicate-detection key
  // and get wrongly skipped as if they were the same appointment.
  const brMatchAnoCurto = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (brMatchAnoCurto) {
    const [, dia, mes, anoCurto] = brMatchAnoCurto;
    // Standard 2-digit-year pivot (same rule Excel itself uses): 00–68 -> 20xx,
    // 69–99 -> 19xx. A perícia scheduling sheet has no plausible use for 1969-1999.
    const ano = Number(anoCurto) <= 68 ? 2000 + Number(anoCurto) : 1900 + Number(anoCurto);
    return `${ano}-${pad2(Number(mes))}-${pad2(Number(dia))}`;
  }

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
