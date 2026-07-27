/**
 * Escapes a user-supplied string for safe interpolation into a PostgREST
 * quoted filter value. PostgREST's filter syntax treats `,` as an
 * OR/AND-clause separator, `)` as a group terminator, and `.` as an
 * operator/path separator, so any of those characters in raw user input
 * (e.g. a search term like "Souza, Maria") can break or hijack the
 * intended filter. Wrapping the value in double quotes — PostgREST's
 * quoted-string filter syntax — makes those characters literal again;
 * this function escapes the characters that remain meaningful inside a
 * quoted string (backslash and double quote itself).
 */
export function escapePostgrestValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Wraps an already-escaped-safe value in PostgREST's quoted-string filter
 * syntax, e.g. for use in `.or()` / `.filter()` calls:
 *   `numero.ilike.${postgrestQuoted('%' + query + '%')}`
 */
export function postgrestQuoted(value: string): string {
  return `"${escapePostgrestValue(value)}"`;
}
