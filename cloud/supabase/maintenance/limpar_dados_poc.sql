-- Estação Ambiental ESP32 — manutenção
-- Limpeza dos dados de desenvolvimento / PoC.
--
-- ATENÇÃO:
-- Este script APAGA TODAS AS LINHAS de public.eventos e public.leituras
-- e reinicia os contadores identity.
-- Ele NÃO altera o schema.
-- Execute apenas quando houver intenção explícita de descartar os dados.

begin;

truncate table public.eventos restart identity;
truncate table public.leituras restart identity;

commit;
