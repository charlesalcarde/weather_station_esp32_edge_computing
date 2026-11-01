# M2 — Recursos computacionais da arquitetura Edge → Cloud

**Projeto:** Estação Ambiental Inteligente com ESP32  
**Documento:** `docs/metricas/02-recursos-computacionais.md`  
**Instrumentação principal:** EXP01b (tempos por etapa e memória dinâmica); registros de compilação e diagnóstico do LittleFS  
**Estado:** caracterização experimental inicial; perfil de CPU, memória por algoritmo e consumo energético ainda não isolados.

> **Escopo:** avaliar a viabilidade de executar o processamento ambiental no ESP32, considerando tempo computacional, RAM/heap, Flash e armazenamento persistente. Os valores apresentados são observações de execuções e versões identificadas, não garantias universais de capacidade.

---

## Índice

- [1. Introdução](#1-introdução)
- [2. Objetivos e perguntas de avaliação](#2-objetivos-e-perguntas-de-avaliação)
- [3. Fundamentação e indicadores](#3-fundamentação-e-indicadores)
  - [3.1 Recursos avaliados](#31-recursos-avaliados)
  - [3.2 Definições operacionais](#32-definições-operacionais)
  - [3.3 Restrições do particionamento](#33-restrições-do-particionamento)
- [4. Ambiente e instrumentação](#4-ambiente-e-instrumentação)
  - [4.1 Plataforma experimental](#41-plataforma-experimental)
  - [4.2 Instrumentação EXP01b](#42-instrumentação-exp01b)
  - [4.3 Compilação e armazenamento](#43-compilação-e-armazenamento)
- [5. Metodologia experimental](#5-metodologia-experimental)
- [6. Resultados observados](#6-resultados-observados)
  - [6.1 Tempo computacional do pipeline](#61-tempo-computacional-do-pipeline)
  - [6.2 Memória dinâmica](#62-memória-dinâmica)
  - [6.3 Flash e partições OTA](#63-flash-e-partições-ota)
  - [6.4 LittleFS e impacto do buffer](#64-littlefs-e-impacto-do-buffer)
- [7. Discussão e interpretação](#7-discussão-e-interpretação)
- [8. Limitações e ameaças à validade](#8-limitações-e-ameaças-à-validade)
- [9. Próximos experimentos](#9-próximos-experimentos)
- [10. Conclusões parciais](#10-conclusões-parciais)
- [11. Referências e documentos relacionados](#11-referências-e-documentos-relacionados)

---

## 1. Introdução

A Estação Ambiental Inteligente executa aquisição de sensores, cálculo de indicadores derivados, análise contextual e manutenção de históricos diretamente em um ESP32. Além disso, mantém serviços de conectividade, dashboard local, atualização OTA e, na versão EXP04b.2, armazenamento persistente de telemetria para recuperação após interrupções de Wi-Fi.

A Métrica M2 caracteriza o custo dessa arquitetura no dispositivo. Sua finalidade é verificar se os algoritmos locais cabem nas restrições de tempo e memória da plataforma **sem confundir viabilidade observada com garantia de comportamento em qualquer cenário**.

Esta avaliação complementa a [M1 — Latência](01-latencia.md), que examina os tempos das etapas, e a [M4 — Resiliência](04-resiliencia.md), que examinará os efeitos de falhas de comunicação e armazenamento.

## 2. Objetivos e perguntas de avaliação

**Objetivo geral:** caracterizar a utilização de recursos computacionais e de armazenamento da estação ESP32 durante a execução dos algoritmos e serviços integrados.

**Objetivos específicos:**

1. Quantificar o tempo de execução do pipeline Edge e de suas etapas instrumentadas.
2. Registrar memória dinâmica disponível e menor valor livre observado desde o boot.
3. Relacionar o tamanho do firmware ao limite real de cada partição de aplicação OTA.
4. Medir a capacidade do LittleFS e o custo do armazenamento persistente.
5. Identificar quais recursos ainda precisam ser medidos antes da inclusão de novos algoritmos, como TinyML.

**Perguntas orientadoras:** o processamento cabe no orçamento temporal de aproximadamente um ciclo por minuto? Qual margem de memória é observada durante a operação? O firmware cabe em cada slot OTA? Como o buffer persistente compete por espaço com os arquivos do dashboard local?

## 3. Fundamentação e indicadores

### 3.1 Recursos avaliados

| Recurso | O que representa | Principal fonte experimental |
|---|---|---|
| Tempo por etapa | Duração instrumentada de cada algoritmo ou bloco do pipeline | EXP01b / Monitor Serial |
| Tempo Edge total | Duração do pipeline local, sem aquisição dos sensores | EXP01b / Monitor Serial |
| Heap livre | Memória dinâmica livre no instante da consulta | Diagnóstico em execução |
| Heap mínimo desde o boot | Menor heap livre registrado pelo mecanismo de diagnóstico | Diagnóstico em execução |
| Variáveis globais/estáticas | Uso de RAM estática estimado na compilação | Saída da IDE |
| Tamanho do sketch | Tamanho da imagem compilada da aplicação | Saída da IDE |
| Capacidade por slot OTA | Tamanho máximo da aplicação na partição efetivamente usada | Tabela de partições |
| LittleFS livre | Espaço disponível no sistema de arquivos | EXP04b.1 / EXP04b.2 |

### 3.2 Definições operacionais

Para uma etapa `i`, a duração instrumentada pode ser representada por:

`T_i = t_fim,i − t_inicio,i`.

O tempo total Edge corresponde ao intervalo definido pela instrumentação do pipeline e **não deve ser obtido somando indiscriminadamente** todos os valores exibidos: algumas medidas podem ter limites distintos e existe overhead residual.

A margem de tempo por ciclo pode ser expressa, apenas como referência, por:

`M_tempo = T_periodo − T_edge`.

Essa expressão **não** representa a folga integral do firmware: aquisição, comunicação HTTPS, interface local, manutenção e outras tarefas também consomem tempo e podem bloquear a execução.

Para memória, é importante diferenciar:

- **RAM estática de compilação:** variáveis globais e estáticas contabilizadas pelo compilador.
- **Heap livre instantâneo:** quantidade disponível no momento da leitura; varia durante a execução.
- **Heap mínimo desde o boot:** indicador histórico de pressão sobre a memória; não é o mesmo que heap disponível agora.
- **Maior bloco contíguo e fragmentação:** ainda não caracterizados sistematicamente; podem limitar alocações mesmo quando o heap total parece suficiente.

### 3.3 Restrições do particionamento

O ESP32 utilizado possui Flash física de **4 MiB**. A arquitetura OTA reserva duas partições de aplicação (`app0` e `app1`), cada uma com **0x1A0000 bytes = 1.703.936 bytes (1.664 KiB)**, além de uma partição LittleFS de **0x0B0000 bytes = 720.896 bytes (704 KiB)**.

A mensagem da IDE `Maximum is 16777216 bytes` corresponde a **16 MiB**, valor que não deve ser usado como capacidade real do firmware neste projeto. O limite relevante para a atualização OTA é o tamanho do slot de aplicação definido no particionamento.

O espaço não ocupado pela aplicação em um slot OTA **não se transforma automaticamente** em espaço disponível para arquivos LittleFS ou para o outro slot.

## 4. Ambiente e instrumentação

### 4.1 Plataforma experimental

| Elemento | Configuração observada |
|---|---|
| Microcontrolador | ESP32 Dev Module, Flash física de 4 MiB |
| Sensores | DHT11 e BMP180 |
| Processamento | Médias móveis, ponto de orvalho, regressão de pressão, análise contextual, históricos, derivados e verificação de variações |
| Comunicação | Wi-Fi e telemetria HTTPS ao Supabase |
| Interface local | Dashboard com arquivos armazenados no LittleFS |
| Atualização | OTA local e OTA remota HTTPS, com dois slots de aplicação |
| Persistência experimental | Arquivos JSON individuais no LittleFS (EXP04b.2) |
| Periodicidade principal | Aproximadamente 60 segundos entre ciclos de aquisição/telemetria |

### 4.2 Instrumentação EXP01b

A EXP01b exibe no Monitor Serial os tempos de aquisição e das etapas do processamento, o total Edge, o número de amostras na janela, o heap livre, o heap mínimo e o uptime. As medições são realizadas em microssegundos (`µs`) para o processamento local.

As janelas históricas crescem inicialmente até **60 amostras**. Portanto, medições obtidas nos primeiros ciclos não devem ser misturadas sem identificação com as de regime estável.

A presença de métricas no firmware permite observar o comportamento integrado da estação, mas **não isola o consumo de RAM de cada algoritmo**. Para isso seria necessária instrumentação específica, com controle de alocações e dos efeitos de outros serviços.

### 4.3 Compilação e armazenamento

A saída de compilação registra o tamanho do sketch e a RAM estática. O diagnóstico LittleFS registra capacidade total, espaço utilizado e espaço livre. Esses dados são complementares: o compilador não mede, por si só, a memória dinâmica em operação; e o espaço livre do LittleFS não indica o espaço restante nos slots OTA.

## 5. Metodologia experimental

1. Identificar a versão do firmware, a tabela de partições e o estado da conectividade.
2. Inicializar a estação e registrar o heap e os tempos dos primeiros ciclos.
3. Acompanhar o crescimento da janela histórica até 60 amostras.
4. Registrar amostras em regime estável, separando aquisição de processamento Edge.
5. Comparar, com identificação da versão, o tamanho do sketch e a RAM estática informados pela IDE.
6. Executar os diagnósticos do LittleFS com o buffer vazio, parcialmente preenchido e próximo do limite de armazenamento.
7. Registrar alterações de comportamento durante interrupção de Wi-Fi e reenvio de dados, sem atribuir automaticamente ao Edge o custo de tarefas de comunicação.

**Unidade de observação:** ciclo de processamento para tempos e heap; compilação para Flash/RAM estática; instante de diagnóstico para LittleFS. Os registros disponíveis são amostras selecionadas do Monitor Serial, não uma exportação integral de todas as séries.

## 6. Resultados observados

### 6.1 Tempo computacional do pipeline

Exemplo observado em execução com janela completa (`60/60`), durante o ensaio prolongado da EXP04b.2:

| Etapa | Duração observada |
|---|---:|
| Aquisição dos sensores | 96.524 µs |
| Médias móveis | 20 µs |
| Ponto de orvalho | 26 µs |
| Regressão de pressão | 327 µs |
| Análise contextual | 140 µs |
| Preparação e histórico | 239 µs |
| Históricos / mínimos / máximos / eventos | 26 µs |
| Derivadas e variação | 3 µs |
| Verificação de saltos | 9 µs |
| Residual / overhead | 15 µs |
| **Processamento Edge total** | **805 µs** |

O tempo Edge desse ciclo equivale a **0,805 ms**, enquanto a aquisição levou **96,524 ms**. Trata-se de um exemplo individual, não de uma média da execução.

Em outra execução, no ciclo 62 com janela `60/60`, observaram-se **326 µs** na regressão e **835 µs** no processamento Edge total. Os valores variam entre ciclos e versões, mas indicam a ordem de grandeza do processamento local instrumentado.

**Interpretação:** o custo de cálculo observado é pequeno em relação ao intervalo nominal entre ciclos. Isso não autoriza concluir que a CPU fica ociosa durante todo o tempo restante, nem medir sua taxa de utilização global; o firmware executa outras atividades não abrangidas por esse cronômetro.

### 6.2 Memória dinâmica

| Contexto experimental | Heap livre | Heap mínimo desde boot | Observação |
|---|---:|---:|---|
| EXP01b/EXP02a/EXP03a, janela completa, ciclo 62 | 188.516 B | 110.960 B | Execução anterior às alterações de resiliência |
| EXP04b.2, durante Wi-Fi OFF, ciclo 169 | 222.172 B | 113.028 B | Processamento local e armazenamento offline |
| EXP04b.2, após reconexão, ciclo 174 | 188.248 B | 113.028 B | Reenvio em andamento |

A diferença de heap livre entre Wi-Fi OFF e reconexão é compatível com maior demanda de memória durante conectividade e comunicação. **Não é possível atribuir causalidade ou quantificar exclusivamente o custo do TLS** a partir desses três pontos, porque há outras alocações e diferenças de estado.

O heap mínimo registrado mostra que, em algum momento desde a inicialização, a memória livre foi menor que a observada nas capturas. Isso justifica medir também o **maior bloco contíguo disponível**, principalmente antes de acrescentar TinyML ou novos buffers em RAM.

### 6.3 Flash e partições OTA

Foram observadas as seguintes saídas de compilação:

| Versão/etapa | Sketch compilado | Variáveis globais | Ocupação do slot OTA de 1.703.936 B |
|---|---:|---:|---:|
| Firmware com EXP01b/EXP02a/EXP03a | 1.299.143 B | 60.472 B | 76,2% |
| EXP04a | 1.301.843 B | 60.528 B | 76,4% |
| EXP04b.1 | 1.303.295 B | 60.528 B | 76,5% |
| EXP04b.2 | 1.307.839 B | 60.568 B | 76,8% |

**Nota:** as porcentagens foram calculadas em relação ao slot OTA efetivo, e não ao máximo de 16 MiB mostrado pela IDE. A tabela não implica que toda a margem restante seja utilizável sem considerar bibliotecas, alinhamento, evolução do firmware e exigências da atualização OTA.

Na EXP04b.2, a diferença entre o slot e o sketch compilado é de **396.097 bytes**, aproximadamente **23,2%** da partição de aplicação. Essa margem é relevante para avaliar futuras funcionalidades, mas **não permite afirmar antecipadamente que um modelo TinyML específico caberá**, pois tamanho do modelo, arena de tensores, heap, pilha e bibliotecas ainda não foram dimensionados.

### 6.4 LittleFS e impacto do buffer

O diagnóstico inicial do LittleFS indicou:

| Indicador | Valor |
|---|---:|
| Capacidade total | 720.896 B (704 KiB) |
| Espaço utilizado com buffer vazio | 135.168 B (132 KiB) |
| Espaço livre inicial | 585.728 B (572 KiB) |
| Reserva operacional ilustrativa | 65.536 B (64 KiB) |

Na EXP04b.2, cada leitura offline foi persistida como um arquivo JSON individual, com conteúdo em torno de **1,9 KB** nas capturas. O custo efetivo no LittleFS foi maior que o tamanho nominal do JSON, devido ao comportamento de alocação e às estruturas do sistema de arquivos.

Durante o teste prolongado, observaram-se **119 registros pendentes**, **65.536 B livres** e aumento do contador de leituras não armazenadas. Posteriormente, a fila foi recuperada e chegou a **0 pendentes**, com **577.536 B livres** no diagnóstico final. A diferença de 8.192 B em relação ao valor inicial merece acompanhamento, sem atribuição de causa apenas pelo diagnóstico disponível.

**Importante:** a reserva de 64 KiB é um critério operacional da versão experimental; o limite de 120 registros é nominal. O teste revelou **34 leituras não armazenadas** ao final do ensaio. Portanto, a autonomia de duas horas não deve ser declarada como garantia sem especificar condições, tamanho dos arquivos e margem de segurança.

O dimensionamento de autonomia maior (por exemplo, 6 ou 12 horas), a compactação e a política de descarte **permanecem decisões de projeto em aberto**.

## 7. Discussão e interpretação

Os resultados permitem sustentar, para as condições observadas, a **viabilidade computacional do pipeline ambiental atual**: seu tempo de execução é da ordem de centenas de microssegundos, a memória dinâmica disponível permaneceu positiva nas capturas e a aplicação coube nos slots OTA utilizados.

Essa constatação exige três qualificações:

1. **Tempo de algoritmo não é uso percentual da CPU.** A taxa de ocupação global exige observar todas as tarefas, interrupções, espera e comunicação, sob janela temporal definida.
2. **Heap livre não é memória garantida para novos algoritmos.** Fragmentação, picos transitórios, maior bloco contíguo e uso simultâneo de TLS, dashboard e TinyML podem impor restrições adicionais.
3. **Flash de aplicação e LittleFS são orçamentos diferentes.** A folga do slot OTA não aumenta a capacidade de retenção do buffer; o LittleFS compartilha espaço com ativos do dashboard local.

O teste do buffer demonstrou que **o armazenamento persistente é, no cenário atual, uma restrição operacional mais evidente que o tempo de cálculo do pipeline Edge**. Essa conclusão vale para o firmware e para a estratégia de arquivos JSON individuais avaliados, não para qualquer solução de persistência futura.

## 8. Limitações e ameaças à validade

| Limitação | Consequência | Ação recomendada |
|---|---|---|
| Capturas pontuais do Monitor Serial | Não fornecem distribuição estatística completa | Exportar logs por ciclo e calcular P50/P95/P99 |
| Diferentes versões e estados de conectividade | Alteram consumo de heap e tamanho do firmware | Identificar versão, Wi-Fi e serviços ativos em cada amostra |
| Instrumentação de tempos sem perfil completo de tarefas | Não permite estimar utilização total da CPU | Medir tempo ocupado por ciclo e tarefas concorrentes |
| Ausência de medição de maior bloco livre | Não caracteriza fragmentação | Registrar `largest_free_block` e heap por capacidade |
| RAM por algoritmo não isolada | Não identifica o custo incremental de cada módulo | Executar comparações controladas e medir picos |
| Compilador informa limite genérico de 16 MiB | Pode induzir interpretação errada da capacidade Flash | Usar a tabela de partições real |
| LittleFS com arquivos JSON individuais | Overhead de armazenamento depende da estratégia e do sistema de arquivos | Medir ocupação real por registro e testar alternativas |
| Ausência de medições de consumo elétrico | Não permite inferir eficiência energética | Medir corrente/energia em condições comparáveis |
| Ambiente doméstico e sensores específicos | Limita generalização para outras plataformas e cargas | Repetir com condições e versões documentadas |

## 9. Próximos experimentos

1. **Série de desempenho em regime estável:** coletar tempos de cada etapa em centenas ou milhares de ciclos, com média, mediana, desvio-padrão e percentis.
2. **Memória dinâmica detalhada:** medir heap livre, mínimo, maior bloco contíguo e alocações relevantes antes/depois de operações HTTPS e de persistência.
3. **Custo incremental:** comparar o firmware de referência com versões que habilitem módulos específicos, preservando as demais condições.
4. **Teste de estresse:** acompanhar processamento e heap com Wi-Fi instável, fila de reenvio cheia e dashboard local acessado simultaneamente.
5. **Orçamento para TinyML:** avaliar, para um modelo concreto, tamanho da biblioteca/modelo em Flash, arena de tensores em RAM, latência de inferência e efeito sobre o ciclo Edge.
6. **Persistência otimizada:** comparar JSON individual, representação compacta e política de retenção escolhida, medindo ocupação efetiva, tempo de escrita, desgaste potencial e recuperação após reset.
7. **Energia:** caso incorporada ao escopo, medir consumo por ciclo e durante comunicação e inferência, sem estimá-lo apenas a partir dos tempos de CPU.

Esses itens são propostas de investigação, não resultados já obtidos.

## 10. Conclusões parciais

A Métrica M2 apresenta evidências iniciais de que o processamento ambiental local é compatível com os recursos do ESP32 utilizado. Em uma captura com janela completa, o pipeline Edge consumiu **805 µs**, excluída a aquisição dos sensores. A versão EXP04b.2 compilou com **1.307.839 bytes**, correspondentes a aproximadamente **76,8%** de um slot OTA de 1.703.936 bytes, e declarou **60.568 bytes** de variáveis globais.

A operação apresentou heap livre positivo nas condições observadas, mas o menor valor desde o boot e a ausência de medições de fragmentação impedem transformar esse resultado em garantia de memória para novas funcionalidades. O teste prolongado do LittleFS evidenciou um limite prático de retenção e perdas de leituras quando a reserva mínima de armazenamento foi atingida.

A conclusão é de **viabilidade observada do firmware atual**, acompanhada de restrições mensuráveis e da necessidade de testes adicionais antes de incorporar modelos TinyML ou ampliar a autonomia de armazenamento.

## 11. Referências e documentos relacionados

### Documentação interna

- [README das métricas](README.md) — metodologia e organização da avaliação.
- [README principal](../../README.md) — visão geral do projeto.
- [M1 — Latência](01-latencia.md) — duração das etapas de aquisição e processamento.
- [M4 — Resiliência](04-resiliencia.md) — a ser produzido; persistência e recuperação de registros.
- [Arquitetura](../02-arquitetura.md) — organização Edge → Cloud.
- [Firmware](../04-firmware.md) — organização do software embarcado.
- [Particionamento Flash](../08-particionamento-flash.md) — layout de memória e OTA.
- [Processamento Edge](../09-processamento-edge.md) — algoritmos e histórico local.

### Referências técnicas

- Espressif Systems — documentação do ESP32, heap capabilities e particionamento Flash.
- Arduino-ESP32 — documentação das APIs de diagnóstico de heap e temporização.
- Espressif Systems — documentação do LittleFS e considerações de armazenamento em Flash.

> **Rastreabilidade:** os resultados numéricos foram extraídos das saídas de compilação e dos diagnósticos seriais compartilhados durante as etapas EXP01b a EXP04b.2. Para uso em artigo científico, devem ser preservados os logs completos, a versão exata do firmware, a tabela de partições e o procedimento de coleta correspondente.
