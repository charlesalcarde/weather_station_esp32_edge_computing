-- Estação Ambiental ESP32 — Schema Cloud v3.4
-- MIGRAÇÃO SEGURA / COMPATÍVEL COM A PoC1a
--
-- Objetivo:
-- 1) manter as colunas legadas "pressao" e "estado" enquanto a PoC1a ainda transmite;
-- 2) adicionar as colunas definitivas da v3.4;
-- 3) criar a tabela de eventos;
-- 4) preservar a telemetria atual sem interrupção.
--
-- NÃO remove nem renomeia colunas usadas pela PoC1a.

begin;

-- ==========================================================
-- NOVAS COLUNAS DA TABELA DE LEITURAS
-- ==========================================================

alter table public.leituras add column if not exists nome_estacao text;
alter table public.leituras add column if not exists hostname_local text;

alter table public.leituras add column if not exists data_local date;
alter table public.leituras add column if not exists hora_local time;
alter table public.leituras add column if not exists epoch bigint;
alter table public.leituras add column if not exists ultima_leitura time;

alter table public.leituras add column if not exists temperatura_media15 float8;
alter table public.leituras add column if not exists temperatura_min_dia float8;
alter table public.leituras add column if not exists hora_temperatura_min time;
alter table public.leituras add column if not exists temperatura_max_dia float8;
alter table public.leituras add column if not exists hora_temperatura_max time;

alter table public.leituras add column if not exists umidade_media15 float8;
alter table public.leituras add column if not exists umidade_min_dia float8;
alter table public.leituras add column if not exists hora_umidade_min time;
alter table public.leituras add column if not exists umidade_max_dia float8;
alter table public.leituras add column if not exists hora_umidade_max time;

-- Mantemos "pressao" como legado da PoC1a e adicionamos os campos definitivos.
alter table public.leituras add column if not exists pressao_mar float8;
alter table public.leituras add column if not exists pressao_local float8;
alter table public.leituras add column if not exists pressao_media15 float8;
alter table public.leituras add column if not exists pressao_media60 float8;
alter table public.leituras add column if not exists pressao_min_dia float8;
alter table public.leituras add column if not exists hora_pressao_min time;
alter table public.leituras add column if not exists pressao_max_dia float8;
alter table public.leituras add column if not exists hora_pressao_max time;
alter table public.leituras add column if not exists variacao_pressao_janela float8;
alter table public.leituras add column if not exists tendencia_pressao_hora float8;

alter table public.leituras add column if not exists ponto_orvalho float8;

-- Mantemos "estado" como legado da PoC1a e adicionamos os campos definitivos.
alter table public.leituras add column if not exists estado_geral text;
alter table public.leituras add column if not exists estado_umidade text;
alter table public.leituras add column if not exists estado_conforto text;
alter table public.leituras add column if not exists estado_pressao text;
alter table public.leituras add column if not exists instabilidade text;
alter table public.leituras add column if not exists anomalia text;

alter table public.leituras add column if not exists numero_alertas int4;
alter table public.leituras add column if not exists alerta1 text;
alter table public.leituras add column if not exists alerta2 text;
alter table public.leituras add column if not exists alerta3 text;
alter table public.leituras add column if not exists alerta4 text;

alter table public.leituras add column if not exists amostras bigint;
alter table public.leituras add column if not exists rssi int4;
alter table public.leituras add column if not exists altitude float8;
alter table public.leituras add column if not exists origem_altitude text;

alter table public.leituras add column if not exists externo_disponivel boolean;
alter table public.leituras add column if not exists externo_tem_dados boolean;
alter table public.leituras add column if not exists externo_local text;
alter table public.leituras add column if not exists externo_cidade text;
alter table public.leituras add column if not exists externo_admin1 text;
alter table public.leituras add column if not exists externo_pais text;
alter table public.leituras add column if not exists externo_latitude float8;
alter table public.leituras add column if not exists externo_longitude float8;
alter table public.leituras add column if not exists externo_fonte text;
alter table public.leituras add column if not exists externo_atualizado time;
alter table public.leituras add column if not exists externo_ultima_tentativa time;
alter table public.leituras add column if not exists externo_temperatura float8;
alter table public.leituras add column if not exists externo_sensacao float8;
alter table public.leituras add column if not exists externo_umidade float8;
alter table public.leituras add column if not exists externo_orvalho float8;
alter table public.leituras add column if not exists externo_pressao_mar float8;
alter table public.leituras add column if not exists externo_pressao_superficie float8;
alter table public.leituras add column if not exists externo_precipitacao float8;
alter table public.leituras add column if not exists externo_chuva float8;
alter table public.leituras add column if not exists externo_prob_chuva float8;
alter table public.leituras add column if not exists externo_nuvens float8;
alter table public.leituras add column if not exists externo_visibilidade float8;
alter table public.leituras add column if not exists externo_uv float8;
alter table public.leituras add column if not exists externo_vento float8;
alter table public.leituras add column if not exists externo_direcao_vento float8;
alter table public.leituras add column if not exists externo_direcao_cardeal text;
alter table public.leituras add column if not exists externo_rajada float8;
alter table public.leituras add column if not exists externo_weather_code int4;
alter table public.leituras add column if not exists externo_is_day boolean;

-- ==========================================================
-- TABELA DE EVENTOS
-- ==========================================================

create table if not exists public.eventos (
  id bigint generated by default as identity primary key,
  created_at timestamptz not null default now(),
  estacao text not null,
  data_local date,
  hora_local time,
  tipo text,
  mensagem text
);

alter table public.eventos enable row level security;

-- ==========================================================
-- PERMISSÕES DE INGESTÃO
-- ==========================================================

grant insert on table public.leituras to anon;
grant insert on table public.eventos to anon;
grant usage, select on all sequences in schema public to anon;

-- Cria a política INSERT para eventos apenas se ainda não existir.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'eventos'
      and policyname = 'ESP32 pode inserir eventos'
  ) then
    create policy "ESP32 pode inserir eventos"
      on public.eventos
      as permissive
      for insert
      to anon
      with check (true);
  end if;
end $$;

commit;

-- ==========================================================
-- OBSERVAÇÕES
-- ==========================================================
-- 1) A PoC1a continua podendo enviar:
--      estacao, temperatura, umidade, pressao, estado
--
-- 2) A v3.4 definitiva passará a preencher:
--      pressao_mar, estado_geral e os demais campos novos.
--
-- 3) Somente depois de validar a v3.4 definitiva, poderemos:
--      - parar de usar pressao e estado;
--      - remover essas duas colunas legadas.
--
-- 4) SELECT para o dashboard remoto será configurado depois.
