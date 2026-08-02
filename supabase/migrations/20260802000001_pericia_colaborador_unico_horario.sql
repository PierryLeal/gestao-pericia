create unique index pericias_colaborador_unico_por_horario
  on public.pericias (colaborador_id, data_agendada, hora_agendada)
  where colaborador_id is not null and data_agendada is not null and hora_agendada is not null;
