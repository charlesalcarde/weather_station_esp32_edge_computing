-- Estação Ambiental ESP32 — Web v3.4 / Etapa 3
-- Migração 05 — função de resumo estatístico para a API Web
begin;

create or replace function public.resumo_estacao_v34(
  p_estacao text,
  p_inicio timestamptz,
  p_fim timestamptz
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
  if p_fim - p_inicio > interval '365 days' then
    raise exception 'periodo maximo excedido';
  end if;

  select jsonb_build_object(
    'amostras', count(*)::bigint,
    'temperatura', jsonb_build_object(
      'min', min(temperatura)::float8,
      'media', avg(temperatura)::float8,
      'max', max(temperatura)::float8,
      'amplitude', case when min(temperatura) is null or max(temperatura) is null
                        then null else (max(temperatura)-min(temperatura))::float8 end
    ),
    'umidade', jsonb_build_object(
      'min', min(umidade)::float8,
      'media', avg(umidade)::float8,
      'max', max(umidade)::float8
    ),
    'pressao_mar', jsonb_build_object(
      'min', min(pressao_mar)::float8,
      'media', avg(pressao_mar)::float8,
      'max', max(pressao_mar)::float8,
      'amplitude', case when min(pressao_mar) is null or max(pressao_mar) is null
                        then null else (max(pressao_mar)-min(pressao_mar))::float8 end
    ),
    'pressao_local', jsonb_build_object(
      'min', min(pressao_local)::float8,
      'media', avg(pressao_local)::float8,
      'max', max(pressao_local)::float8,
      'amplitude', case when min(pressao_local) is null or max(pressao_local) is null
                        then null else (max(pressao_local)-min(pressao_local))::float8 end
    ),
    'ponto_orvalho', jsonb_build_object(
      'min', min(ponto_orvalho)::float8,
      'media', avg(ponto_orvalho)::float8,
      'max', max(ponto_orvalho)::float8
    ),
    'externo', jsonb_build_object(
      'temperatura', jsonb_build_object(
        'min', min(externo_temperatura)::float8,
        'media', avg(externo_temperatura)::float8,
        'max', max(externo_temperatura)::float8
      ),
      'umidade', jsonb_build_object(
        'min', min(externo_umidade)::float8,
        'media', avg(externo_umidade)::float8,
        'max', max(externo_umidade)::float8
      ),
      'pressao_mar', jsonb_build_object(
        'min', min(externo_pressao_mar)::float8,
        'media', avg(externo_pressao_mar)::float8,
        'max', max(externo_pressao_mar)::float8
      )
    ),
    'qualidade_dados', jsonb_build_object(
      'temperatura_validas', count(temperatura)::bigint,
      'umidade_validas', count(umidade)::bigint,
      'pressao_mar_validas', count(pressao_mar)::bigint,
      'ponto_orvalho_validas', count(ponto_orvalho)::bigint
    )
  )
  into v_result
  from public.leituras
  where estacao = p_estacao
    and created_at >= p_inicio
    and created_at <= p_fim;

  return v_result;
end;
$$;

revoke all on function public.resumo_estacao_v34(text,timestamptz,timestamptz) from public;
revoke all on function public.resumo_estacao_v34(text,timestamptz,timestamptz) from anon;
revoke all on function public.resumo_estacao_v34(text,timestamptz,timestamptz) from authenticated;
grant execute on function public.resumo_estacao_v34(text,timestamptz,timestamptz) to service_role;

commit;
