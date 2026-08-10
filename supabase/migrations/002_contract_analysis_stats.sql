-- Análisis de contratos: índices + estadísticas de categoría calculadas en Postgres.
--
-- Motivo: PostgREST corta toda respuesta en 1.000 filas, y el filtro por categoría
-- UNSPSC vive dentro de `raw_data` (JSON) sin índice, así que un scan ordenado de
-- 60.000 filas supera el statement timeout. Resultado: la mediana, el percentil y
-- el promedio se calculaban sobre un recorte arbitrario. Aquí se resuelve en el
-- servidor: agregación exacta sobre el universo completo, en una sola llamada.

-- 1) Índices que faltaban para los filtros del análisis on-demand.
create index if not exists contracts_category_code_idx
  on public.contracts ((raw_data->>'codigo_de_categoria_principal'));

create index if not exists contracts_entity_nit_idx
  on public.contracts (entity_nit);

create index if not exists contracts_contractor_id_idx
  on public.contracts (contractor_id);

-- 2) Estadísticas de la categoría sobre el universo DISTRITAL completo.
--    El criterio distrital replica `isDistrital()` de lib/patterns/helpers.ts:
--    orden = Territorial, o nombre de entidad claramente distrital.
create or replace function public.contract_category_stats(
  p_cat   text,
  p_value numeric
)
returns table (
  n               bigint,
  mediana         numeric,
  promedio        numeric,
  p90             numeric,
  maximo          numeric,
  percentil       numeric,
  mediana_cop_dia numeric
)
language sql
stable
as $$
  with universo as (
    select
      c.contract_value::numeric as v,
      c.start_date,
      c.end_date
    from public.contracts c
    where c.raw_data->>'codigo_de_categoria_principal' = p_cat
      and c.contract_value is not null
      and c.contract_value > 0
      and (
        lower(coalesce(c.entity_order, '')) = 'territorial'
        or c.entity_name ~* 'distrital|distrito capital|alcald[íi]a local|bogot[áa]\s*d\.?\s*c'
      )
  ),
  ritmos as (
    select v / nullif(end_date - start_date, 0) as cop_dia
    from universo
    where start_date is not null
      and end_date is not null
      and end_date > start_date
  )
  select
    count(*),
    percentile_cont(0.5) within group (order by v),
    avg(v),
    percentile_cont(0.9) within group (order by v),
    max(v),
    case
      when count(*) > 0 and p_value is not null then
        100.0 * (select count(*) from universo u where u.v < p_value)::numeric / count(*)
    end,
    (select percentile_cont(0.5) within group (order by cop_dia)
       from ritmos where cop_dia > 0)
  from universo;
$$;
