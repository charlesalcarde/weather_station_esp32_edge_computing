# Homologação funcional — firmware v3.6.9

> **Data:** 15–16/11/2026. **Situação:** homologação funcional aprovada a partir de ensaios na placa; ensaio prolongado da revisão final ainda pendente. **Fonte do firmware testado:** `EstacaoAmbiental_v3_6_9_HOMOLOGACAO_CORRECAO_HORARIOS.ino`.

## Índice

- [1. Motivação](#1-motivação)
- [2. Escopo da correção](#2-escopo-da-correção)
- [3. Resultados observados](#3-resultados-observados)
- [4. Procedimento de validação](#4-procedimento-de-validação)
- [5. Limitações e publicação](#5-limitações-e-publicação)

## 1. Motivação

Em 13/11/2026, uma indisponibilidade da sincronização NTP na rede local expôs uma dependência temporal que podia impedir a operação normal da estação. A correção busca preservar a aquisição e o processamento Edge mesmo sem sincronização inicial.

## 2. Escopo da correção

- Solicitação SNTP não bloqueante para o Edge.
- Validação de horários antes de enviar telemetria e durante o replay de registros persistidos.
- Campos de horários de extremos ainda desconhecidos (temperatura, umidade e pressão) transmitidos como JSON `null`, nunca como `"--:--"`.
- Preservação das políticas existentes EXP04, LittleFS, sensores, dashboard local, Open-Meteo, OTA e integração Supabase.
- Ausência de rotina de limpeza automática do LittleFS na versão homologada.

O incidente `HTTP 400` / PostgreSQL `22007` foi reproduzido quando um campo de tipo `time` recebia `"--:--"`. A validação de payload corrigiu a incompatibilidade.

## 3. Resultados observados

| Indicador | Evidência |
|---|---|
| Supabase, recuperação de pendentes | HTTP 201; 21 registros recuperados; fila zerada |
| LittleFS | Buffer ativo; 0 pendentes de 300; 0 falhas definitivas |
| Dashboard remoto Vercel | Estação reportada online |
| Transmissões Cloud subsequentes | 9 sucessos / 0 falhas; HTTP 201 |
| Processamento Edge, ciclo 13 | 634 µs, excluindo aquisição de sensores |
| Aquisição dos sensores, ciclo 13 | 97.232 µs |
| Memória heap livre, ciclo 13 | 183.816 bytes |
| Uptime observado, ciclo 13 | 727 s |

As métricas são **observações pontuais dos logs**, não garantias de latência, disponibilidade ou estabilidade prolongada.

## 4. Procedimento de validação

1. Usar o mesmo esquema de partições; não apagar toda a flash e não formatar o LittleFS.
2. Verificar boot, sensores BMP180/DHT11, Wi-Fi e processamento Edge.
3. Confirmar SNTP não bloqueante e comportamento local sem referência temporal.
4. Observar POST e replay com HTTP 201/2xx, sem erro `22007`.
5. Executar `EXP04 BUFFER` e verificar fila, integridade e falhas.
6. Confirmar dados atualizados e status online no Vercel.
7. Manter observação prolongada como verificação complementar.

## 5. Limitações e publicação

- Homologação **funcional**, não certificação de operação ininterrupta por dias.
- Leituras realizadas antes de uma referência temporal confiável não recebem horário absoluto inventado.
- Horários de extremos registrados antes do NTP podem permanecer `null` até sua renovação ou reinicialização.
- O manifesto `releases/version.json` e o binário OTA **não devem ser atualizados** sem compilação, exportação do binário, checksum e aprovação explícita da implantação.
- O sketch deve ser publicado a partir do **arquivo exato testado**; não substituir por reconstruções de versões anteriores.
