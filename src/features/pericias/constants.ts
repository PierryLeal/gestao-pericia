/** The exact message `create/update_pericia_with_colaboradores` returns for a
 *  23505 (double-booking) violation — exported so callers (the bulk-import
 *  confirm flow, e.g.) can recognize this specific failure and react to it
 *  instead of just displaying it.
 *
 *  Lives outside actions.ts because a "use server" file may only export
 *  async functions — a plain constant export breaks the build. */
export const ERRO_COLABORADOR_CONFLITANTE = 'Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.';
