# Diagnóstico operacional — Estação Ambiental ESP32

> **Situação:** guia de investigação, não relatório de causa-raiz. Revisão inicial em 13/11/2026.

## Índice

- [1. Objetivo](#1-objetivo)
- [2. Separação das camadas](#2-separação-das-camadas)
- [3. Sequência de diagnóstico](#3-sequência-de-diagnóstico)
- [4. Incidente de 13/11/2026](#4-incidente-de-13112026)
- [5. Evidências para uma intervenção presencial](#5-evidências-para-uma-intervenção-presencial)
- [6. Referências](#6-referências)

## 1. Objetivo

Distinguir falhas de alimentação, inicialização, execução do firmware, rede local, persistência, comunicação com Supabase e visualização Web, evitando atribuir a indisponibilidade a uma única camada sem evidência.

## 2. Separação das camadas

```text
Fonte / regulador → ESP32 / boot → firmware / sensores / LittleFS
                                      ├── LED / dashboard local
                                      ├── Wi-Fi / IP / HTTP local
                                      └── envio Supabase → API Vercel → dashboard Web
```

Uma ausência de telemetria na Cloud **não demonstra**, isoladamente, que o ESP32 deixou de executar. Da mesma forma, LED de alimentação aceso não comprova tensão estável no módulo ESP32 sob carga.

## 3. Sequência de diagnóstico

1. **Alimentação:** conferir a especificação da entrada externa da shield, a fonte utilizada e, presencialmente, medir as tensões de entrada e de saída do regulador sob carga. Não aplicar 9 V diretamente a pinos de alimentação do módulo ESP32.
2. **Boot e execução:** registrar o padrão do LED integrado e capturar o log serial desde a energização; verificar resets repetidos, watchdog, brownout e erros de montagem do filesystem.
3. **Rede local:** confirmar associação Wi-Fi, DHCP, IP atribuído e acessibilidade da rota HTTP local. Um IP anteriormente conhecido pode ter mudado.
4. **Persistência:** consultar capacidade e integridade do LittleFS, sem apagar arquivos antes de preservar evidências.
5. **Cloud:** comparar horários da última leitura local, do último POST e da última linha armazenada no Supabase; diferenciar falha de conexão, autenticação e indisponibilidade do serviço.
6. **OTA:** identificar versão em execução, slot ativo e histórico de atualizações antes de tentar nova gravação. Evitar intervenção remota quando o nó não está acessível.
7. **Recuperação:** somente após coletar evidências, avaliar reinicialização, regravação controlada ou substituição da fonte.

## 4. Incidente de 13/11/2026

**Observações comunicadas:**

- A estação deixou de transmitir ao Supabase durante a madrugada.
- A conexão de Internet do local foi informada como funcional.
- O LED de alimentação permaneceu aceso.
- O LED integrado apresentou piscada lenta/anormal, inclusive após desligar e religar.
- A tentativa de acesso pelo endereço local `192.168.15.37` não teve sucesso.
- O OLED não estava disponível para diagnóstico.
- O conjunto utiliza ESP32 montado em shield com entrada de alimentação externa; foi informada fonte de 9 V conectada à entrada da shield.

**Conclusão permitida:** existe falha operacional ainda não localizada entre alimentação, boot, firmware e conectividade. Não há evidência suficiente para concluir defeito de regulador, corrupção de firmware, falha no Supabase ou falha do próprio ESP32.

**Próximo teste previsto:** intervenção presencial com medições elétricas e log serial.

## 5. Evidências para uma intervenção presencial

Registrar data/hora local e UTC, tensão de entrada da shield, tensão regulada sob carga, mensagens seriais completas do boot, versão de firmware, motivo de reset, estado Wi-Fi/IP, estado do LittleFS, última telemetria confirmada e eventuais mudanças recentes de hardware ou OTA. Preservar os logs antes de reset de fábrica, formatação ou regravação.

## 6. Referências

- [Operação e manutenção](10-operacao.md)
- [Firmware](04-firmware.md)
- [Conectividade](06-conectividade.md)
- [Cloud](07-cloud.md)
- [OTA remota](14-ota-remota.md)
- [M4 — Resiliência](metricas/04-resiliencia.md)
