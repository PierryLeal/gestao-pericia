-- A bulk import row can arrive missing a município/perito match, or even
-- fail to parse a processo at all — today those rows are silently dropped
-- instead of saved, forcing a re-import once the source sheet is fixed.
-- From now on they're saved as-is and fixed later via the edit dialog, so
-- these references can no longer be mandatory at the database level.
alter table public.pericias alter column processo_id drop not null;
alter table public.pericias alter column municipio_id drop not null;
alter table public.pericias alter column perito_id drop not null;

-- The new spreadsheet import format groups rows under a banner row per
-- "contrato" (e.g. "VALE BRUMADINHO") — that name belongs to the processo,
-- not the pericia, since every pericia for that processo shares it.
alter table public.processos add column contrato text;
create index processos_contrato_idx on public.processos (contrato);
