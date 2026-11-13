# Instalação e preparação da Estação Ambiental ESP32

> **Escopo:** orientação de preparação para o firmware v3.6.7 versionado no repositório. Não substitui a verificação presencial da montagem elétrica.

## Índice

- [1. Arquivos de referência](#1-arquivos-de-referência)
- [2. Preparação do ambiente](#2-preparação-do-ambiente)
- [3. Verificação elétrica](#3-verificação-elétrica)
- [4. Gravação do firmware](#4-gravação-do-firmware)
- [5. Recursos LittleFS](#5-recursos-littlefs)
- [6. Verificações após inicialização](#6-verificações-após-inicialização)
- [7. Atualizações e recuperação](#7-atualizações-e-recuperação)

## 1. Arquivos de referência

- Firmware: [`EstacaoAmbiental_v3_6_7_OTA_HTTPS_TARGET.ino`](../firmware/estacao_ambiental/EstacaoAmbiental_v3_6_7_OTA_HTTPS_TARGET.ino).
- Partições: [`partitions.csv`](../firmware/estacao_ambiental/partitions.csv).
- Interface local: [`firmware/estacao_ambiental/data/`](../firmware/estacao_ambiental/data/).
- [README específico do firmware](../firmware/estacao_ambiental/README-firmware.md) e [hardware](03-hardware.md).

## 2. Preparação do ambiente

Utilizar Arduino IDE e suporte à família ESP32 compatível com a placa real. Instalar as bibliotecas exigidas pelos `#include` do firmware e conferir as versões antes de compilar. Selecionar placa, porta serial, parâmetros de Flash e tabela de partições compatíveis com `partitions.csv`. Não assumir que as configurações padrão da IDE correspondem ao layout do projeto.

## 3. Verificação elétrica

Conferir sensores, GPIOs, níveis lógicos e alimentação conforme [Hardware](03-hardware.md). Se a montagem utilizar uma shield com entrada externa de 9 V, confirmar que essa entrada e o regulador foram projetados para a tensão fornecida. **Nunca conectar 9 V diretamente aos pinos 3V3/5V do ESP32.** Em caso de falhas intermitentes, medir tensão regulada sob carga antes de alterar firmware.

## 4. Gravação do firmware

1. Preservar versão, configurações e registros relevantes da instalação existente.
2. Conferir `partitions.csv` e o tamanho do binário compilado.
3. Compilar o arquivo `.ino` de referência; registrar mensagens e avisos.
4. Gravar por interface serial apenas após verificar porta, placa e alimentação.
5. Capturar o log serial desde o primeiro boot e registrar versão, motivo de reset e estado de rede.

**Atenção:** uma regravação com opções de apagamento da Flash pode destruir configurações NVS e arquivos LittleFS. Não realizar apagamento integral como primeira tentativa de diagnóstico.

## 5. Recursos LittleFS

A interface embarcada usa os arquivos em `firmware/estacao_ambiental/data/`. A transferência do filesystem é uma operação separada da gravação do firmware e depende de ferramenta compatível com o ambiente e com a tabela de partições. Preservar arquivos e dados persistidos antes de substituir o filesystem.

## 6. Verificações após inicialização

Verificar logs de boot, sensores, conectividade Wi-Fi, endereço IP, dashboard local, sincronização temporal, comunicação com Supabase e atualização das leituras no dashboard Web. Não confundir ausência de telemetria remota com ausência de processamento Edge.

## 7. Atualizações e recuperação

- [OTA remota](14-ota-remota.md): manifesto, autorização de instalação, integridade e limitações.
- [Diagnóstico operacional](16-diagnostico-operacional.md): sequência de investigação de alimentação, boot, conectividade e Cloud.
- [M4 — Resiliência](metricas/04-resiliencia.md): ensaios de buffer/replay EXP04c/EXP04d, não presumidos como parte do firmware v3.6.7.
