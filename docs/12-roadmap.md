# Roadmap — Estação Ambiental ESP32

> **Revisão documental:** 13/11/2026. O estado de implementação é inferido dos arquivos versionados na branch `main` nessa data; o estado de implantação física ou em produção requer verificação específica. Este documento substitui o planejamento histórico da fase v3.4-RC1.

## Índice

- [1. Critérios de classificação](#1-critérios-de-classificação)
- [2. Linha de base verificada](#2-linha-de-base-verificada)
- [3. Resultados experimentais](#3-resultados-experimentais)
- [4. Prioridades de engenharia](#4-prioridades-de-engenharia)
- [5. Prioridades científicas](#5-prioridades-científicas)
- [6. Critérios para conclusão](#6-critérios-para-conclusão)
- [7. Referências](#7-referências)

## 1. Critérios de classificação

| Estado | Significado |
| --- | --- |
| **Versionado** | Há implementação identificável no código do repositório |
| **Validado em experimento** | Existe ensaio documentado com escopo e limitações explícitos |
| **Publicado** | Há evidência de implantação em serviço; não decorre automaticamente de estar versionado |
| **Homologado** | Há critérios de aceitação definidos e cumpridos para a funcionalidade e o ambiente previstos |
| **Planejado** | Ainda exige implementação, integração ou validação |

Um mesmo recurso pode estar versionado, mas não homologado. Experimentos isolados não alteram automaticamente o firmware de referência.

## 2. Linha de base verificada

| Componente | Estado em 13/11/2026 | Evidência e ressalva |
| --- | --- | --- |
| Aquisição e processamento ambiental Edge | **Versionado** | Firmware `EstacaoAmbiental_v3_6_7_OTA_HTTPS_TARGET.ino` |
| Dashboard local LittleFS | **Versionado** | `firmware/estacao_ambiental/data/` |
| Conectividade Wi-Fi e telemetria Supabase | **Versionado** | Firmware e `web/api/_supabase.js` |
| OTA local ArduinoOTA | **Versionado** | Firmware e [documentação OTA](14-ota-remota.md) |
| OTA remota HTTPS com manifesto e autorização `install` | **Versionado; histórico de teste documentado** | Firmware v3.6.7; inspeção de segurança pendente |
| Consulta periódica OTA remota | **Versionado: 6 horas** | `INTERVALO_OTA_REMOTA = 21600000UL`; não afirmar 5 minutos |
| Autenticação TLS do servidor remoto por CA | **Não demonstrada** | Há chamadas executáveis a `setInsecure()` e nenhuma a `setCACert()` no firmware de referência |
| Dashboard Web Vercel | **Versionado** | `web/src/main.js`, `web/api/`; implantação deve ser confirmada separadamente |
| Horizontes 60 min, 24 h, 7 d, 30 d e personalizado | **Versionado** | Interface Web |
| Análises contextualizadas local × externo | **Versionado** | Interface Web; resultados exploratórios |
| Parecer com IA Gemini | **Versionado** | `POST /api/parecer`; limitações de proteção da API |
| Laboratório M5 sobre série bruta | **Versionado** | `GET /api/m5-serie`; simulação, não economia real |

## 3. Resultados experimentais

| Experimento | Resultado documentado | Limite |
| --- | --- | --- |
| EXP01b / EXP02a / EXP03a | Instrumentação de latência, recursos e comunicação | Resultados dependem das condições dos ensaios |
| EXP04c.3c.1 | Ensaio prolongado de buffer e replay, com perdas observadas | Não comprova 12 horas sem perdas |
| EXP04c.3c.2 | Recuperação funcional em ensaio curto de Wi-Fi OFF, fallback e replay | Homologação prolongada pendente |
| EXP04d | Recuperação após corte de energia **entre** gravações | Corte **durante** gravação não homologado |
| EXP05 M5-A/B/C | Simulação retrospectiva de políticas de retenção | Não mede redução real de energia, bytes transmitidos ou requisições do ESP32 |

Consultar os relatórios [M4](metricas/04-resiliencia.md) e [M5](metricas/05-transformacao-dados.md). O laboratório M5 Web tem recorte e método próprios.

## 4. Prioridades de engenharia

### P1 — Confiabilidade e diagnóstico

- [ ] Diagnosticar presencialmente o incidente de 13/11/2026, preservando logs e medições antes de intervenções destrutivas.
- [ ] Integrar de forma rastreável a versão experimental de persistência/replay ao firmware de referência, **se** aprovada após os testes.
- [ ] Definir e executar ensaio de 12 horas sem perdas, incluindo saturação, falha de rede, reinicialização e recuperação.
- [ ] Testar interrupção de energia durante a escrita e documentar integridade, perdas e duplicidades.
- [ ] Tornar observáveis versão ativa, causa de reset, espaço LittleFS e estado da fila.

### P2 — OTA e segurança

- [ ] Substituir `setInsecure()` por validação de certificado/CA adequada nos fluxos HTTPS pertinentes, com testes de falha e renovação.
- [ ] Verificar autenticidade e integridade do firmware além da simples comparação de hash obtido pelo mesmo canal de distribuição.
- [ ] Decidir e implementar, com testes, a cadência OTA pretendida de aproximadamente 5 minutos; **não está ativa no código de referência**.
- [ ] Especificar e validar downgrade autorizado, rollback automático e OTA do LittleFS, separadamente.
- [ ] Avaliar proteção da OTA local e automação de build/release.

### P3 — Cloud e dashboard

- [ ] Implementar proteção distribuída de frequência/cota para `/api/parecer` e verificar procedência das evidências.
- [ ] Documentar a revisão efetivamente implantada na Vercel e seu vínculo com o commit Git.
- [ ] Verificar migrações, RLS, privilégios mínimos e exposição de credenciais.
- [ ] Consolidar indicadores de disponibilidade temporal e observabilidade, preservando a distinção entre ausência de telemetria e parada do Edge.

## 5. Prioridades científicas

- [ ] Avaliar defasagem e atenuação entre medições locais e referência Open-Meteo em janelas definidas, com critérios de suficiência amostral.
- [ ] Separar localização física da estação, referência meteorológica externa e campanha de medição; exigir confirmação para mudanças físicas.
- [ ] Comparar políticas M5 sob os mesmos dados, métricas e restrições de reconstrução.
- [ ] Medir em firmware real volume transmitido, quantidade de requisições e consumo energético antes de alegar economia.
- [ ] Investigar TinyML somente após estabelecer orçamento de Flash, heap, RAM e latência.
- [ ] Avaliar implantação multies­tação e campanhas em ambientes urbanos, laboratórios, escolas ou museus.

## 6. Critérios para conclusão

Uma funcionalidade só muda de estado quando houver: identificação de versão e commit; descrição do cenário; critérios de aceitação; logs ou medições; resultados e limitações; e atualização da documentação correspondente. Para Cloud, incluir evidência da implantação; para firmware, incluir a versão efetivamente gravada e testada.

## 7. Referências

- [Arquitetura](02-arquitetura.md)
- [Firmware](04-firmware.md)
- [Dashboard Web e Cloud](15-dashboard-web-cloud.md)
- [OTA remota](14-ota-remota.md)
- [Diagnóstico operacional](16-diagnostico-operacional.md)
- [Programa de métricas](metricas/README.md)
