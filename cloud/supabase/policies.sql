-- Estação Ambiental ESP32 — Supabase
-- Políticas e permissões de ingestão da v3.4.
--
-- Objetivo:
-- permitir que o cliente ESP32 insira telemetria utilizando credencial
-- publicável apropriada, sem conceder privilégios administrativos.
--
-- Este arquivo NÃO cria política pública de SELECT.
-- A política de leitura será definida junto com o dashboard remoto.

begin;

alter table public.leituras enable row level security;
alter table public.eventos enable row level security;

grant insert on table public.leituras to anon;
grant insert on table public.eventos to anon;
grant usage, select on all sequences in schema public to anon;

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

-- Observação:
-- A política INSERT de public.leituras já existia no ambiente da PoC
-- e não é recriada aqui sem antes registrar seu nome/definição exatos.
-- Evitamos inventar ou duplicar uma policy já homologada.
