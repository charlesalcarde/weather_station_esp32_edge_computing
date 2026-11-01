# M4 — Resiliência operacional da arquitetura Edge → Cloud

**Projeto:** Estação Ambiental Inteligente com ESP32  
**Documento:** `docs/metricas/04-resiliencia.md`  
**Instrumentação principal:** EXP04a, EXP04b.1 e EXP04b.2  
**Estado:** experimentos funcionais e prolongados realizados; dimensionamento definitivo, entrega idempotente e política de descarte ainda em estudo.

> **Escopo:** avaliar a continuidade do processamento ambiental local durante a indisponibilidade da rede, a persistência de telemetria em LittleFS e a recuperação posterior dos registros. A resiliência do processamento Edge, a persistência local e a entrega à Cloud são propriedades distintas e devem ser avaliadas separadamente.

---

## Índice

- [1. Introdução](#1-introdução)
- [2. Objetivos e perguntas de avaliação](#2-objetivos-e-perguntas-de-avaliação)
- [3. Fundamentação e indicadores](#3-fundamentação-e-indicadores)
  - [3.1 Domínios de falha e continuidade](#31-domínios-de-falha-e-continuidade)
  - [3.2 Indicadores operacionais](#32-indicadores-operacionais)
  - [3.3 Definições e fórmulas](#33-definições-e-fórmulas)
- [4. Ambiente e instrumentação](#4-ambiente-e-instrumentação)
  - [4.1 Plataforma experimental](#41-plataforma-experimental)
  - [4.2 EXP04a — desconexão sem buffer](#42-exp04a--desconexão-sem-buffer)
  - [4.3 EXP04b.1 — diagnóstico do LittleFS](#43-exp04b1--diagnóstico-do-littlefs)
  - [4.4 EXP04b.2 — buffer persistente](#44-exp04b2--buffer-persistente)
- [5. Metodologia experimental](#5-metodologia-experimental)
- [6. Resultados observados](#6-resultados-observados)
  - [6.1 Continuidade sem buffer](#61-continuidade-sem-buffer)
  - [6.2 Capacidade do filesystem](#62-capacidade-do-filesystem)
  - [6.3 Recuperação após reinicialização](#63-recuperação-após-reinicialização)
  - [6.4 Teste prolongado e saturação](#64-teste-prolongado-e-saturação)
  - [6.5 Recuperação e verificação na Cloud](#65-recuperação-e-verificação-na-cloud)
- [7. Discussão e interpretação](#7-discussão-e-interpretação)
- [8. Limitações e ameaças à validade](#8-limitações-e-ameaças-à-validade)
- [9. Próximos experimentos](#9-próximos-experimentos)
- [10. Conclusões parciais](#10-conclusões-parciais)
- [11. Referências e documentos relacionados](#11-referências-e-documentos-relacionados)

---

## 1. Introdução

A estação executa aquisição de sensores, cálculos ambientais, classificação de estados e apresentação local diretamente no ESP32. A persistência histórica e a visualização remota dependem de serviços externos. Assim, uma falha de Wi-Fi ou do serviço Cloud pode comprometer a telemetria sem necessariamente interromper o processamento local.

A **Métrica M4 — Resiliência** investiga essa separação funcional e a evolução da estação de uma arquitetura que descartava transmissões durante desconexões (**EXP04a**) para uma implementação experimental com **buffer persistente em LittleFS e reenvio automático** (**EXP04b.2**). A etapa intermediária **EXP04b.1** avaliou o espaço de armazenamento disponível.

O objetivo não é demonstrar tolerância irrestrita a falhas, mas delimitar, por evidência experimental, **o que continua funcionando, o que pode ser recuperado e em quais condições ocorrem perdas**.

## 2. Objetivos e perguntas de avaliação

**Objetivo geral:** caracterizar a capacidade do nó Edge de continuar processando dados e recuperar telemetria diante de interrupções de comunicação, reinicializações e limitação do armazenamento local.

**Objetivos específicos:**

1. Verificar a continuidade da aquisição e do processamento local com Wi-Fi indisponível.
2. Medir o tempo de reconexão e de retomada do envio HTTPS.
3. Caracterizar a capacidade real do LittleFS compartilhado com o dashboard embarcado.
4. Verificar a persistência da fila após reinicialização do ESP32.
5. Observar o reenvio e a remoção dos registros após confirmação HTTP.
6. Identificar perdas por saturação e falhas de reenvio.
7. Distinguir confirmação HTTP de garantias de integridade, unicidade e ordenação no banco.

**Perguntas orientadoras:** o processamento local continua durante a falha? Por quanto tempo o armazenamento disponível suporta a telemetria produzida? O que acontece quando a fila se aproxima do limite? A recuperação preserva o instante original da leitura? Quais garantias ainda não foram verificadas?

## 3. Fundamentação e indicadores

### 3.1 Domínios de falha e continuidade

```text
BMP180 / DHT11
       │
       ▼
     ESP32 ─────► Processamento Edge ─────► Dashboard local (LAN)
       │                   │
       │                   └──► estados, tendências e eventos
       ▼
  JSON de telemetria
       │
       ├── conexão disponível ───────► POST HTTPS ───────► Supabase
       │
       └── conexão indisponível ─────► LittleFS / fila persistente
                                           │
                                           └── reconexão ─► reenvio HTTPS
```

O diagrama representa os caminhos funcionais, não simultaneidade garantida de todas as operações. O dashboard local depende de acesso à rede local; durante uma desconexão total do Wi-Fi, a execução Edge pode continuar mesmo que o navegador não consiga alcançá-lo.

A avaliação separa três propriedades:

- **Continuidade local:** aquisição e processamento prosseguem sem conexão externa.
- **Durabilidade temporária:** leituras não enviadas sobrevivem à interrupção e, quando aplicável, à reinicialização.
- **Recuperação da telemetria:** registros pendentes são aceitos pela API após a conectividade retornar.

### 3.2 Indicadores operacionais

| Indicador | Unidade | Interpretação |
|---|---|---|
| Continuidade dos ciclos Edge | ciclos, evidência de logs | Processamento local durante a falha |
| Tempo de indisponibilidade simulada | s ou min | Intervalo de falha induzida |
| Tempo de reconexão Wi-Fi | ms ou s | Retorno da associação à rede |
| Tempo até primeiro HTTP de sucesso | ms ou s | Retomada observada da telemetria |
| Registros pendentes | registros | Ocupação lógica da fila |
| Espaço livre LittleFS | bytes | Capacidade física remanescente |
| Registros não armazenados | registros | Perdas definitivas identificadas pelo firmware |
| Registros recuperados | registros | Reenvios aceitos conforme resposta HTTP |
| Falhas de gravação/reenvio | ocorrências | Erros contabilizados na execução |

### 3.3 Definições e fórmulas

Para uma sequência de eventos com instantes medidos no mesmo relógio monotônico:

$$
T_{\mathrm{reconexao}}=t_{\mathrm{WiFi\ conectado}}-t_{\mathrm{WiFi\ retorno\ solicitado}}
$$

$$
T_{\mathrm{retomada\ HTTP}}=t_{\mathrm{primeiro\ HTTP\ 2xx}}-t_{\mathrm{WiFi\ retorno\ solicitado}}
$$

A ocupação lógica da fila, em relação ao limite configurado, é:

$$
O_{\mathrm{fila}}=\frac{N_{\mathrm{pendentes}}}{N_{\mathrm{limite}}}\times100\%
$$

Uma aproximação de autonomia nominal, **não uma garantia**, para geração de uma leitura por minuto é:

$$
A_{\mathrm{nominal}}\approx N_{\mathrm{registros\ armazenaveis}}\times1\ \mathrm{minuto}
$$

A capacidade efetiva depende do tamanho de cada registro, dos blocos de alocação do filesystem, dos arquivos do dashboard, da reserva de segurança e da política de descarte. Por isso, não se deve converter automaticamente `120 registros` em `120 minutos garantidos`.

## 4. Ambiente e instrumentação

### 4.1 Plataforma experimental

- **Nó:** ESP32 Dev Module, Flash física de 4 MiB, com duas partições de aplicação para OTA.
- **Sensores:** BMP180 e DHT11.
- **Filesystem:** LittleFS de 720.896 bytes (704 KiB), compartilhado com os arquivos do dashboard local.
- **Telemetria:** JSON transmitido por HTTPS/REST ao Supabase, em cadência nominal próxima de uma leitura por minuto.
- **Instrumentação:** mensagens no Monitor Serial, comandos `EXP04` e consulta posterior à tabela de leituras na Cloud.

Os testes descritos correspondem a versões experimentais derivadas da plataforma v3.6.7. Não se presume que todos os recursos de EXP04b.2 já façam parte de uma release estável publicada.

### 4.2 EXP04a — desconexão sem buffer

A EXP04a introduziu controle de conectividade por comandos de teste, preservando a execução do processamento local. A ausência de buffer permitiu estabelecer uma **linha de base de perda de telemetria** durante a indisponibilidade.

Comandos principais:

```text
EXP04 OFF
EXP04 ON
EXP04 STATUS
```

### 4.3 EXP04b.1 — diagnóstico do LittleFS

A EXP04b.1 introduziu a observação da capacidade do filesystem, por meio de `EXP04 FS`, antes da implementação de armazenamento persistente. O cálculo preliminar baseado apenas no tamanho do JSON foi tratado como **estimativa teórica**, não como capacidade efetiva de arquivos.

### 4.4 EXP04b.2 — buffer persistente

A EXP04b.2 implementou:

- armazenamento de cada JSON pendente em arquivo próprio no LittleFS, com arquivo temporário e renomeação;
- varredura de arquivos pendentes durante o boot;
- fila lógica limitada nominalmente a **120 registros**;
- reserva de **64 KiB** de espaço livre;
- reenvio de até **um registro a cada 10 segundos**, quando há conexão;
- exclusão do arquivo somente após resposta HTTP **200, 201 ou 204**;
- manutenção dos registros antigos e **descarte de novas leituras** quando não há capacidade;
- preservação dos campos originais de tempo (`data_local`, `hora_local` e `epoch`) no JSON armazenado.

Comandos adicionais:

```text
EXP04 FS
EXP04 BUFFER
EXP04 REPLAY
```

O comando `EXP04 BUFFER` informa pendentes, gravados, recuperados, não armazenados e falhas. Os contadores de gravação e recuperação são **desde o boot** e podem representar conjuntos diferentes de registros, especialmente após reinicialização.

## 5. Metodologia experimental

O conjunto de experimentos foi conduzido em etapas, preservando o processamento ambiental existente:

1. **Linha de base sem buffer:** provocar indisponibilidade com `EXP04 OFF`, acompanhar os ciclos locais e observar o retorno com `EXP04 ON`.
2. **Diagnóstico de armazenamento:** consultar `EXP04 FS` e calcular o espaço disponível antes de ativar a fila.
3. **Teste funcional do buffer:** provocar uma desconexão curta, observar o crescimento de pendentes e confirmar o reenvio após a reconexão.
4. **Teste de persistência:** reiniciar o ESP32 com registros pendentes, verificar a reconstrução da fila e sua recuperação posterior.
5. **Teste prolongado:** manter o dispositivo sem Wi-Fi até a aproximação do limite físico, registrar perdas e observar o esvaziamento da fila após reconexão.
6. **Verificação externa:** consultar o Supabase para comparar o instante original da medição com o instante de inserção.

Os valores numéricos a seguir são **observações de execuções específicas**, não estatísticas populacionais nem garantias de desempenho. A ausência de um log integral consolidado impede calcular intervalos de confiança e percentis com rigor.

## 6. Resultados observados

### 6.1 Continuidade sem buffer

Na EXP04a, uma interrupção simulada de aproximadamente **252.883 ms** (4,21 min) não interrompeu o processamento Edge. Entretanto, **quatro janelas de telemetria foram perdidas** na ausência de persistência local.

| Indicador | Observação EXP04a |
|---|---:|
| Intervalo sem Wi-Fi | 252.883 ms |
| Leituras não enviadas/recuperadas | 4 |
| Reconexão Wi-Fi após retorno solicitado | ~4.737 ms |
| Primeiro sucesso HTTP após retorno solicitado | ~6.648 ms |
| Processamento local | Continuou durante a falha |

Os tempos de reconexão e retomada foram medidos no contexto da execução observada. Não representam latência máxima garantida em outras redes ou condições de sinal.

### 6.2 Capacidade do filesystem

O diagnóstico inicial da EXP04b.1 registrou:

| Indicador | Valor |
|---|---:|
| Capacidade LittleFS | 720.896 bytes |
| Espaço utilizado inicialmente | 135.168 bytes |
| Espaço livre inicialmente | 585.728 bytes |
| Reserva de segurança adotada | 65.536 bytes |
| Orçamento teórico após reserva | 520.192 bytes |
| Exemplo de tamanho de JSON | 1.926 bytes |
| Capacidade teórica por divisão simples | ~270 registros |

A divisão `520.192 / 1.926` **ignora a granularidade de alocação e os metadados do LittleFS**. Ela não foi confirmada como capacidade real.

No teste prolongado, observou-se que a adição de aproximadamente **22 registros** consumiu **98.304 bytes** de espaço, equivalentes a cerca de **4.469 bytes de redução do espaço livre por registro**, em média naquele trecho. Esse valor não deve ser generalizado sem novas medições, mas mostra por que o JSON de ~1,9 KiB não é uma medida suficiente do custo de armazenamento.

### 6.3 Recuperação após reinicialização

Em um ensaio de desconexão de aproximadamente **15 minutos**, a fila persistente foi reconstruída após reinicialização:

| Evidência | Resultado observado |
|---|---|
| Pendências reconhecidas no boot | 13 registros |
| Reenvios aceitos posteriormente | 15 registros |
| Composição dos reenvios | 13 anteriores ao boot + 2 adicionais |
| Pendências ao término | 0 |
| Falhas registradas nesse ensaio | 0 |

Esse ensaio demonstra **persistência funcional através de uma reinicialização normal** e capacidade de reenvio dos registros reconhecidos. Não equivale a ensaio de desligamento abrupto durante escrita, corrupção de filesystem ou garantia de entrega exatamente uma vez.

### 6.4 Teste prolongado e saturação

Em uma execução com **mais de duas horas de indisponibilidade**, o processamento Edge continuou enquanto a fila crescia até a proximidade da reserva de espaço.

| Marco experimental | Observação |
|---|---|
| 97 registros pendentes | 163.840 bytes livres no LittleFS |
| 119 registros pendentes | 65.536 bytes livres no LittleFS |
| Durante a saturação | Alertas de espaço insuficiente e perda definitiva de novas leituras |
| Em um ponto intermediário | 29 leituras já não armazenadas |
| Ciclo Edge observado | Ciclo 169, aquisição 96.524 µs e processamento Edge 805 µs |
| Uptime no ponto observado | ~10.087 s (aproximadamente 2 h 48 min) |
| Heap livre no ponto observado | 222.172 bytes |

Após a reconexão, houve reenvios aceitos com **HTTP 201**. O resumo final do firmware informou:

| Contador final da execução | Valor |
|---|---:|
| Pendentes | **0 / 120** |
| Gravados desde o boot | 145 |
| Recuperados desde o boot | 158 |
| Não armazenados | **34** |
| Falhas de gravação | 0 |
| Falhas de reenvio | 1 |
| Espaço livre LittleFS | 577.536 bytes |

**Interpretação obrigatória:** a fila foi esvaziada, mas **não houve recuperação integral das leituras geradas durante a falha**, pois 34 leituras foram descartadas por falta de espaço. Os 158 registros recuperados não devem ser divididos pelos 145 gravados para calcular uma taxa de recuperação: os contadores podem abranger registros anteriores ao boot e eventos com escopos distintos. A falha de reenvio contabilizada não impediu o esvaziamento posterior da fila, mas seu motivo e tratamento merecem investigação.

O espaço livre final ficou **8.192 bytes abaixo** do valor inicial de 585.728 bytes, embora a fila estivesse vazia. A causa dessa diferença não foi determinada e não deve ser atribuída automaticamente a vazamento ou corrupção.

### 6.5 Recuperação e verificação na Cloud

Consultas ao Supabase mostraram registros com `created_at` posterior ao instante original indicado por `hora_local`, coerentes com o reenvio de leituras acumuladas. Em uma amostra, a defasagem entre coleta e inserção chegou a aproximadamente **14,5 minutos** e diminuiu à medida que o reenvio avançou.

Esse resultado fornece evidência de **inserção posterior de dados históricos**, mas não constitui auditoria completa de unicidade, integridade campo a campo, ausência de lacunas ou ordenação de todos os registros. O `created_at` representa a inserção no banco, enquanto os campos de tempo originais representam a leitura, sujeitos às condições de sincronização do relógio do dispositivo.

## 7. Discussão e interpretação

### Autonomia Edge e dependência da Cloud

A continuidade de ciclos de aquisição e processamento durante `EXP04 OFF` sustenta a propriedade arquitetural de **autonomia do processamento local**. Ela não implica disponibilidade do dashboard via navegador durante ausência total de conectividade Wi-Fi, nem acesso à referência externa Open-Meteo.

### Persistência e recuperação são condicionais

A EXP04b.2 acrescentou tolerância a interrupções temporárias ao conservar leituras e recuperá-las posteriormente. O teste de reinicialização demonstra a utilidade de persistir os registros no LittleFS, em vez de mantê-los apenas na RAM.

Contudo, a capacidade observada foi limitada pelo espaço físico compartilhado com o dashboard. A política atual prioriza os registros antigos: ao atingir o limite, **novas leituras são descartadas**. Essa escolha preserva a ordem histórica da fila, mas sacrifica a atualização dos dados mais recentes durante falhas prolongadas.

### Por que a capacidade nominal não equivale à autonomia garantida

O limite lógico de 120 registros e a cadência nominal de um registro por minuto sugerem aproximadamente duas horas em condições ideais. O teste, porém, alcançou 119 pendentes com o espaço livre no patamar de reserva e registrou perdas. A autonomia real precisa ser medida em múltiplas execuções, levando em conta variações do payload, overhead de armazenamento e ocupação prévia do LittleFS.

### Semântica de entrega

A exclusão de um arquivo após HTTP 2xx reduz a chance de perda de um registro não confirmado. Ainda assim, se o servidor persistir um registro e a resposta se perder, o dispositivo poderá reenviá-lo, gerando duplicidade na ausência de **identificador idempotente e restrição de unicidade**. A implementação atual não demonstra entrega *exactly once*.

### Impacto no desempenho e no tráfego

O reenvio HTTPS é uma operação potencialmente bloqueante, com timeout previsto de 12 s na implementação experimental. A recuperação de filas também produz tráfego adicional e pode afetar temporariamente a cadência dos ciclos. Esse comportamento precisa ser correlacionado com [M1 — Latência](01-latencia.md), [M2 — Recursos computacionais](02-recursos-computacionais.md) e [M3 — Comunicação](03-comunicacao.md). Os contadores originais de payload da EXP03a não incluem necessariamente os reenvios da EXP04b.2.

## 8. Limitações e ameaças à validade

1. **Falha simulada:** `EXP04 OFF` não reproduz necessariamente todas as características de perda real de energia, falha de roteador, DNS, TLS ou indisponibilidade exclusiva do Supabase.
2. **Amostras limitadas:** os resultados apresentados derivam de execuções específicas, sem repetições suficientes para inferência estatística.
3. **Compartilhamento do LittleFS:** o dashboard e a fila competem pela mesma partição; atualizações de arquivos podem alterar a capacidade disponível.
4. **Custo de armazenamento:** a granularidade de alocação torna inadequada a estimativa baseada somente no tamanho do JSON.
5. **Reinicialização normal versus falha abrupta:** o teste de persistência não cobre todas as condições de desligamento durante escrita ou renomeação.
6. **Confirmação HTTP:** resposta 2xx não prova ausência de duplicidades nem integridade histórica completa.
7. **Tempo e sincronização:** comparação entre `created_at`, `epoch` e `hora_local` requer relógios coerentes e tratamento de fuso horário.
8. **Dados externos:** durante a desconexão, a Open-Meteo não é retroconsultada; atributos externos podem permanecer desatualizados, sem marcação explícita de frescor.
9. **Operações bloqueantes:** falhas HTTPS e reenvios podem interferir no tempo de resposta local, exigindo medição específica.
10. **Política de saturação:** o descarte de novas leituras é um comportamento atual, não uma política de retenção definitiva aprovada.

## 9. Próximos experimentos

| Prioridade | Experimento proposto | Evidência esperada |
|---|---|---|
| Alta | Repetir desconexões de diferentes durações | Distribuição da autonomia real e das perdas |
| Alta | Validar unicidade no Supabase por ID estável | Identificação e prevenção de duplicidades |
| Alta | Medir bytes, tempo e CPU durante replay | Custo de recuperação nas métricas M1–M3 |
| Alta | Testar indisponibilidade exclusiva da API, com Wi-Fi ativo | Separar falhas de rede e falhas Cloud |
| Média | Simular reboot e queda de energia em pontos críticos da gravação | Robustez do protocolo de persistência |
| Média | Comparar JSON por arquivo, formato compacto e registros agrupados | Capacidade útil e custo computacional |
| Média | Avaliar política circular e descarte por idade/prioridade | Trade-off entre histórico e atualidade |
| Média | Marcar validade e idade dos dados Open-Meteo | Qualidade semântica dos registros recuperados |
| Média | Dimensionar autonomia-alvo de 2, 6 ou 12 horas | Decisão baseada em memória, risco e requisitos |
| Futura | Ensaiar falhas combinadas e múltiplas estações | Resiliência sistêmica Edge → Cloud |

**Decisões em aberto:** autonomia desejada, compactação, substituição de registros antigos ou novos em saturação, estratégia não bloqueante de reenvio e mecanismos de idempotência. Nenhuma dessas alternativas deve ser descrita como já implementada.

## 10. Conclusões parciais

Os experimentos demonstraram que o ESP32 **continua adquirindo e processando informações ambientais durante a indisponibilidade de Wi-Fi**, sustentando a autonomia funcional do Edge. Sem buffer, a falha de comunicação produziu perda de telemetria. Com a EXP04b.2, o sistema passou a persistir registros no LittleFS, reconstruir a fila após reinicialização e reenviar leituras quando a conexão retorna.

A evidência também expôs um limite concreto: no teste prolongado, a fila atingiu o patamar de reserva do filesystem, **34 novas leituras não foram armazenadas** e o reenvio posterior esvaziou somente os registros efetivamente preservados. Portanto, o resultado correto é **resiliência parcial, mensurada e condicionada à capacidade disponível**, e não ausência absoluta de perdas.

A próxima etapa científica consiste em dimensionar o armazenamento, controlar duplicidades e medir o custo da recuperação, estabelecendo critérios explícitos para a autonomia exigida da estação.

## 11. Referências e documentos relacionados

### Documentação interna

- [README — Programa de avaliação das métricas](README.md).
- [M1 — Latência](01-latencia.md).
- [M2 — Recursos computacionais](02-recursos-computacionais.md).
- [M3 — Comunicação](03-comunicacao.md).
- [Arquitetura da estação](../02-arquitetura.md).
- [Integração Cloud](../07-cloud.md).
- [Particionamento Flash, OTA e LittleFS](../08-particionamento-flash.md).
- [Processamento Edge](../11-processamento-edge.md).
- [Operação e diagnóstico](../10-operacao.md).

### Artefatos e evidências experimentais

- Instrumentação **EXP04a**: comandos de desconexão/reconexão e logs de continuidade.
- Instrumentação **EXP04b.1**: diagnóstico `EXP04 FS` e levantamento de capacidade.
- Instrumentação **EXP04b.2**: README experimental do firmware, comandos `EXP04 BUFFER`/`EXP04 REPLAY`, logs de saturação e recuperação.
- Consultas de verificação na tabela de telemetria do Supabase, com comparação entre horário original e inserção.

> **Nota de rastreabilidade:** os números são transcritos das observações experimentais discutidas no projeto e devem ser associados aos logs brutos e à identificação exata do build na consolidação final. Não são apresentados como resultados de uma campanha estatística completa.
