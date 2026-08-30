-- Estação Ambiental ESP32 — Web v3.4 / Etapa 2
-- Migração 04 — função de histórico agregado para a API Web
--
-- Objetivo:
--   permitir consultas históricas eficientes sem enviar dezenas de
--   milhares de leituras brutas ao Vercel/navegador.
--
-- Segurança:
--   a função não é pública para anon/authenticated.
--   O endpoint server-side do Vercel usa a Secret Key do Supabase.
--
-- Pode ser executada novamente: CREATE OR REPLACE FUNCTION é idempotente.

begin;

create or replace function public.historico_estacao_v34(
  p_estacao text,
  p_inicio timestamptz,
  p_fim timestamptz,
  p_bucket_seconds integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if p_estacao is null or btrim(p_estacao) = '' then
    raise exception 'estacao obrigatoria';
  end if;

  if p_inicio is null or p_fim is null or p_inicio >= p_fim then
    raise exception 'intervalo invalido';
  end if;

  if p_bucket_seconds not in (60, 900, 3600, 86400) then
    raise exception 'resolucao invalida';
  end if;

  if p_fim - p_inicio > interval '365 days' then
    raise exception 'periodo maximo excedido';
  end if;

  with agrupado as (
    select
      date_bin(
        make_interval(secs => p_bucket_seconds),
        created_at,
        timestamptz '2000-01-01 00:00:00+00'
      ) as bucket,
      avg(temperatura)::float8 as temperatura,
      avg(umidade)::float8 as umidade,
      avg(pressao_mar)::float8 as pressao_mar,
      avg(pressao_local)::float8 as pressao_local,
      avg(ponto_orvalho)::float8 as ponto_orvalho,
      avg(externo_temperatura)::float8 as externo_temperatura,
      avg(externo_umidade)::float8 as externo_umidade,
      avg(externo_pressao_mar)::float8 as externo_pressao_mar,
      count(*)::bigint as amostras
    from public.leituras
    where estacao = p_estacao
      and created_at >= p_inicio
      and created_at <= p_fim
    group by 1
    order by 1
  )
  select jsonb_build_object(
    'dados',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'timestamp', bucket,
          'temperatura', temperatura,
          'umidade', umidade,
          'pressao_mar', pressao_mar,
          'pressao_local', pressao_local,
          'ponto_orvalho', ponto_orvalho,
          'externo_temperatura', externo_temperatura,
          'externo_umidade', externo_umidade,
          'externo_pressao_mar', externo_pressao_mar,
          'amostras', amostras
        )
        order by bucket
      ),
      '[]'::jsonb
    ),
    'pontos', count(*)::bigint,
    'amostras', coalesce(sum(amostras), 0)::bigint
  )
  into v_result
  from agrupado;

  return v_result;
end;
$$;

revoke all on function public.historico_estacao_v34(
  text, timestamptz, timestamptz, integer
) from public;

revoke all on function public.historico_estacao_v34(
  text, timestamptz, timestamptz, integer
) from anon;

revoke all on function public.historico_estacao_v34(
  text, timestamptz, timestamptz, integer
) from authenticated;

grant execute on function public.historico_estacao_v34(
  text, timestamptz, timestamptz, integer
) to service_role;

commit;
