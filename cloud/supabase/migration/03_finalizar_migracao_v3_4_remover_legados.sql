-- Estação Ambiental ESP32 — Finalização da migração v3.4
-- Status no ambiente atual: APLICADA E VALIDADA em 2026-08-28.
-- Mantida no repositório como histórico de migração e para reprodução
-- de instalações que ainda possuam as colunas legadas "pressao" e "estado".

begin;

alter table public.leituras drop column if exists pressao;
alter table public.leituras drop column if exists estado;

commit;
