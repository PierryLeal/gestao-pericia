# CRUD e Filtro — Melhorias (Pacote A) — Design

**Contexto:** após o deploy inicial em produção, o usuário levantou 4 lacunas de UX no CRUD existente de Perícias/Peritos/Processos/Colaboradores. Este spec cobre só essas 4 (o pacote B — autenticação e gestão de usuários — é um spec separado).

## Escopo

1. Data/Hora agendada da Perícia deixam de ser obrigatórias.
2. Excluir Perícia, Perito, Processo e Colaborador.
3. Limpar o campo Colaborador (opcional) no formulário de Perícia.
4. Filtro de Data das Perícias vira intervalo (data inicial / data final).

## 1. Data/Hora opcionais

**Banco de dados:** nova migration removendo `NOT NULL` de `pericias.data_agendada` e `pericias.hora_agendada`.

```sql
-- supabase/migrations/20260730000001_pericia_data_hora_opcionais.sql
alter table public.pericias alter column data_agendada drop not null;
alter table public.pericias alter column hora_agendada drop not null;
```

Aplicada via `supabase db push` nos dois projetos (dev `wpssipdxpfmvcamldpum` e produção `ralyhgneesqpfijpvxii`).

**Schema (`src/features/pericias/schemas.ts`):** `dataAgendada`/`horaAgendada` passam de `z.string().regex(...)` para `z.string().regex(...).nullable()`. `PericiaInput['dataAgendada' | 'horaAgendada']` vira `string | null`.

**Formulário (`pericia-form.tsx`):** ao montar o payload de envio, converte string vazia em `null`: `dataAgendada: dataAgendada || null, horaAgendada: horaAgendada || null`. Nenhuma mudança visual nos campos — eles já não bloqueavam digitação, só o server action rejeitava no submit.

**Actions (`src/features/pericias/actions.ts`):**
- `PericiaListItem.dataAgendada`/`horaAgendada`: `string` → `string | null`.
- `toRow`/`fromRow`: sem lógica extra, só o tipo muda (Supabase já aceita/retorna `null` nativamente).
- Ordenação: `.order('data_agendada', { ascending: false, nullsFirst: false })` — perícias sem data sempre por último, independente da direção.

**Exibição (`pericias-table.tsx`):** a célula "Data - Hora" hoje monta `new Date(`${dataAgendada}T${horaAgendada}`)`, o que quebra com `null`. Nova lógica:
- Nenhum dos dois preenchido → `"Não agendado"` (texto `text-muted-foreground`, mesmo padrão usado em "Nenhum colaborador vinculado").
- Só data preenchida → mostra a data formatada + `"Hora não definida"`.
- Só hora preenchida (caso raro) → `"Data não definida"` + hora.
- Os dois preenchidos → comportamento atual, sem mudança.

## 2. Excluir Perícia / Perito / Processo / Colaborador

**Permissão:** mesma de criar/editar — `requireRole(['admin', 'gerencia'])`.

**Tipo de exclusão:** definitiva (hard delete). Sem coluna de soft-delete.

**Perito e Processo têm FK `on delete restrict` a partir de `pericias`** (já existente no schema, sem mudança de migration). Excluir um Perito/Processo referenciado por alguma Perícia falha no banco com o código Postgres `23503` (foreign_key_violation) — a action captura esse código e devolve uma mensagem amigável em vez do erro cru do Postgres.

**Colaborador tem FK `on delete set null`** (já existente) — excluir um colaborador vinculado é sempre permitido; a(s) perícia(s) afetada(s) simplesmente perdem a referência.

**Perícia** não é referenciada por nenhuma outra tabela — exclusão sempre permitida, sem tratamento especial de erro.

**Novas server actions** (mesmo arquivo `actions.ts` de cada feature), todas retornando `ActionResult<null>`:

```ts
// src/features/peritos/actions.ts
export async function deletePerito(id: number): Promise<ActionResult<null>> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { error } = await supabase.from('peritos').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      return { success: false, error: 'Não é possível excluir: há perícias vinculadas a este perito.' };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data: null };
}
```

O mesmo padrão para `deleteProcesso` (mensagem "...vinculadas a este processo."), `deleteColaborador` (sem branch de `23503` — não é alcançável, já que a FK é `set null`) e `deletePericia` (sem branch de `23503` — nada referencia `pericias`).

Nenhuma action existente usa `revalidatePath`; o padrão do projeto é o Screen chamar `router.refresh()` após a mutação. As novas actions seguem o mesmo padrão — não chamam `revalidatePath`.

**Componente compartilhado** `src/components/shared/confirm-dialog.tsx` (novo), reutilizado nas 4 tabelas:

```tsx
'use client';
export function ConfirmDialog({
  open, onOpenChange, title, description, onConfirm, loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? 'Excluindo...' : 'Excluir'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Padrão nas 4 tabelas** (`pericias-table.tsx`, `peritos-table.tsx`, `processos-table.tsx`, `colaboradores-table.tsx`): cada uma já recebe `onEdit` do Screen; passa a receber também `onDelete: (item) => Promise<void>`. A tabela guarda localmente `const [confirmTarget, setConfirmTarget] = useState<T | null>(null)` e `const [deleting, setDeleting] = useState(false)`. Um ícone `Trash2` (lucide) ao lado do `Pencil` existente chama `setConfirmTarget(item)`. O `ConfirmDialog` chama, ao confirmar:

```ts
async function handleConfirmDelete() {
  if (!confirmTarget) return;
  setDeleting(true);
  await onDelete(confirmTarget);
  setDeleting(false);
  setConfirmTarget(null);
}
```

**Nos 4 Screens** (`pericias-screen.tsx`, `peritos-screen.tsx`, `processos-screen.tsx`, `colaboradores-screen.tsx`), o `onDelete` passado para a tabela chama a action, mostra toast e atualiza a lista:

```ts
async function handleDelete(item: Perito) {
  const result = await deletePerito(item.id);
  if (result.success) {
    toast.success('Perito excluído');
    router.refresh();
  } else {
    toast.error(result.error);
  }
}
```

Texto de confirmação por tela (usa o campo mais identificável do registro):
- Perícia: `Excluir a perícia do processo "${numero}"? Essa ação não pode ser desfeita.`
- Perito/Colaborador: `Excluir "${nome}"? Essa ação não pode ser desfeita.`
- Processo: `Excluir o processo "${numero}"? Essa ação não pode ser desfeita.`

## 3. Limpar Colaborador no formulário de Perícia

`pericia-form.tsx` já usa um `Select` (Base UI, não o `OptionCombobox` dos filtros) para Colaborador, com `items={colaboradorItems}` e um placeholder "Selecione um colaborador". Mesmo padrão já usado no filtro de Situação: adiciona um item fixo no topo:

```tsx
<SelectContent>
  <SelectItem value="none">Nenhum</SelectItem>
  {colaboradores.map((c) => (
    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
  ))}
</SelectContent>
```

E ajusta o `items` passado ao `Select` (usado pelo `SelectValue` pra resolver o rótulo) para incluir `{ none: 'Nenhum', ...colaboradorItems }`, e o `onValueChange` para tratar `'none'` como limpar: `onValueChange={(v) => setColaboradorId(v === 'none' ? '' : (v ?? ''))}`. O valor do `Select` já usa `colaboradorId || 'none'` (em vez de string vazia, já que Base UI Select precisa de um item correspondente ao valor atual).

## 4. Filtro de Perícias por intervalo de data

**Semântica** (já validada com o usuário):
- Data inicial e final iguais → só aquele dia.
- Só final preenchida → tudo até aquela data (inclusive).
- Só inicial preenchida → tudo a partir daquela data (inclusive).
- Nenhuma preenchida → sem filtro de data.
- Nenhuma validação de "inicial > final" — nesse caso a consulta naturalmente não retorna nada (`gte` + `lte` incompatíveis), sem mensagem de erro especial.

**URL:** parâmetros `data` (removido) → `dataInicio` e `dataFim`.

**`src/app/(app)/page.tsx`:** `searchParams` troca `data?: string` por `dataInicio?: string; dataFim?: string`, repassados para `listPericias`.

**`src/features/pericias/actions.ts` (`listPericias`):**
```ts
if (filters.dataInicio) query = query.gte('data_agendada', filters.dataInicio);
if (filters.dataFim) query = query.lte('data_agendada', filters.dataFim);
```
(substitui o atual `if (filters.data) query = query.eq('data_agendada', filters.data);`)

**`pericias-filters.tsx`:** a célula "Data" do grid (hoje um único `<Input type="date">`) vira dois inputs lado a lado sob o mesmo `<Label>Data</Label>`, mantendo a grade de 6 células (3 colunas × 2 linhas) sem adicionar uma 7ª:

```tsx
<div className="space-y-1.5">
  <Label>Data</Label>
  <div className="flex items-center gap-1">
    <Input
      type="date" aria-label="Data inicial" title="Data inicial"
      value={searchParams.get('dataInicio') ?? ''}
      onChange={(e) => updateParam('dataInicio', e.target.value)}
    />
    <span className="text-muted-foreground text-xs">até</span>
    <Input
      type="date" aria-label="Data final" title="Data final"
      value={searchParams.get('dataFim') ?? ''}
      onChange={(e) => updateParam('dataFim', e.target.value)}
    />
  </div>
</div>
```

`hasActiveFilters` e `handleClearFilters` trocam a checagem/remoção de `data` por `dataInicio` e `dataFim` (ambas).

## Testes

- `masks.test.ts`/schemas: nenhum impacto.
- `pericias/schemas.ts`: cobrir `dataAgendada`/`horaAgendada` aceitando `null`.
- `pericias/actions.test.ts`: cobrir `listPericias` com `dataInicio`/`dataFim` isolados e combinados (mock `.gte`/`.lte`); cobrir `deletePericia` sucesso; cobrir `deletePerito`/`deleteProcesso` mapeando erro `23503` para a mensagem amigável.
- Componentes de tabela: cobrir clique no ícone de lixeira abrindo o `ConfirmDialog`, confirmar chamando `onDelete`, cancelar não chamando.
- `pericia-form.test.tsx`: cobrir seleção de "Nenhum" limpando `colaboradorId`.
- `pericias-filters.test.tsx`: cobrir os 4 cenários de intervalo de data (exato, só início, só fim, nenhuma).

## Fora de escopo (não mexe)

- Autenticação, usuários, perfis (pacote B, spec separado).
- Qualquer mudança em Situação, Local, Perito, Busca (filtros já existentes, sem alteração).
- Soft delete / auditoria de exclusões.
