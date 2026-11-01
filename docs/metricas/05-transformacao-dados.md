# M5 — Transformação e enriquecimento dos dados no Edge

**Projeto:** Estação Ambiental Inteligente com ESP32  
**Documento:** `docs/metricas/05-transformacao-dados.md`  
**Experimento planejado:** EXP05  
**Estado:** protocolo experimental proposto; **EXP05 ainda não executado**. As funções de processamento citadas são capacidades existentes da estação, não resultados medidos desta métrica.

> **Escopo:** caracterizar como medições ambientais são convertidas em indicadores, séries temporais, classificações e eventos no ESP32, e avaliar o custo e a utilidade desse enriquecimento. A existência de mais campos não demonstra, por si só, maior qualidade informacional, precisão ou economia de comunicação.

---

## Índice

- [1. Introdução](#1-introdução)
- [2. Objetivos e perguntas de avaliação](#2-objetivos-e-perguntas-de-avaliação)
- [3. Fundamentação conceitual](#3-fundamentação-conceitual)
  - [3.1 Dado bruto, indicador e decisão](#31-dado-bruto-indicador-e-decisão)
  - [3.2 Transformação, enriquecimento e redundância](#32-transformação-enriquecimento-e-redundância)
  - [3.3 Qualidade da informação](#33-qualidade-da-informação)
- [4. Arquitetura e transformações existentes](#4-arquitetura-e-transformações-existentes)
  - [4.1 Fontes e variáveis de entrada](#41-fontes-e-variáveis-de-entrada)
  - [4.2 Operações locais](#42-operações-locais)
  - [4.3 Saídas e consumidores](#43-saídas-e-consumidores)
- [5. Indicadores propostos para a M5](#5-indicadores-propostos-para-a-m5)
  - [5.1 Inventário e cobertura das transformações](#51-inventário-e-cobertura-das-transformações)
  - [5.2 Expansão de atributos](#52-expansão-de-atributos)
  - [5.3 Custo computacional incremental](#53-custo-computacional-incremental)
  - [5.4 Custo de comunicação](#54-custo-de-comunicação)
  - [5.5 Utilidade funcional](#55-utilidade-funcional)
- [6. Metodologia experimental proposta](#6-metodologia-experimental-proposta)
  - [6.1 Condições e cenários](#61-condições-e-cenários)
  - [6.2 Instrumentação e coleta](#62-instrumentação-e-coleta)
  - [6.3 Procedimento EXP05](#63-procedimento-exp05)
  - [6.4 Tratamento estatístico](#64-tratamento-estatístico)
- [7. Plano de registro dos resultados](#7-plano-de-registro-dos-resultados)
- [8. Discussão prevista e hipóteses](#8-discussão-prevista-e-hipóteses)
- [9. Limitações e ameaças à validade](#9-limitações-e-ameaças-à-validade)
- [10. Próximos passos e critérios de conclusão](#10-próximos-passos-e-critérios-de-conclusão)
- [11. Referências e documentos relacionados](#11-referências-e-documentos-relacionados)

---

## 1. Introdução

Em uma arquitetura convencional de telemetria, o dispositivo pode limitar-se a coletar medidas e encaminhá-las para processamento posterior. Na Estação Ambiental ESP32, parte da interpretação ocorre no próprio microcontrolador: as leituras alimentam cálculos, históricos, tendências, classificações e eventos, que podem ser consumidos localmente e, conforme o esquema de telemetria, enviados à Cloud.

A **Métrica M5 — Transformação e enriquecimento dos dados** pretende caracterizar esse processamento do ponto de vista informacional e operacional. Diferentemente das métricas M1–M4, **a M5 ainda não dispõe de uma campanha experimental própria**. Este documento formaliza previamente perguntas, indicadores, condições e critérios de coleta, para reduzir o risco de escolher métricas apenas depois de observar os resultados.

O interesse acadêmico não é maximizar o número de campos produzidos, mas identificar **quais transformações são úteis, quanto custam e quais compromissos introduzem**.

---

## 2. Objetivos e perguntas de avaliação

**Objetivo geral:** avaliar sistematicamente a transformação de dados ambientais no ESP32, relacionando produtos informacionais, custo computacional, custo de transmissão e capacidade de interpretação local.

**Objetivos específicos:**

1. Inventariar entradas, transformações, saídas e respectivas dependências.
2. Diferenciar valores diretamente medidos de indicadores calculados, estados categóricos, eventos e referências externas.
3. Quantificar a expansão do esquema de dados sem confundi-la com ganho de informação útil.
4. Medir o custo incremental de CPU e memória associado às transformações, quando tecnicamente isolável.
5. Comparar o tamanho de payloads equivalentes com dados essenciais e com dados enriquecidos.
6. Identificar funções locais que dependem dos indicadores derivados, por exemplo, alertas e visualização de tendências.
7. Registrar limitações de precisão, atualidade, redundância e rastreabilidade.

**Perguntas orientadoras:**

- Quais interpretações a estação consegue produzir localmente a partir das medições e de seu histórico?
- Qual o custo adicional dessas operações no ESP32?
- Quais informações derivadas precisam ser transmitidas e quais poderiam permanecer no Edge?
- O enriquecimento melhora a capacidade funcional demonstrável ou apenas amplia o payload?

---

## 3. Fundamentação conceitual

### 3.1 Dado bruto, indicador e decisão

Para esta avaliação, adota-se a seguinte distinção operacional:

| Categoria | Definição | Exemplos no projeto |
|---|---|---|
| Medição local | Valor adquirido de sensor físico | Temperatura, umidade relativa, pressão |
| Indicador derivado | Valor calculado a partir de medições, parâmetros ou histórico | Ponto de orvalho, pressão ao nível do mar, média móvel |
| Indicador temporal | Caracterização de evolução no tempo | Tendência barométrica, mínimos e máximos |
| Estado ou classificação | Interpretação categórica baseada em regras | Faixas de umidade, conforto, estado ambiental |
| Evento ou alerta | Ocorrência detectada segundo critérios definidos | Variação rápida, anomalia, alerta local |
| Referência externa | Informação obtida de serviço remoto | Dados meteorológicos Open-Meteo |
| Metadado operacional | Informação sobre dispositivo, conectividade ou coleta | Horários, estado de comunicação, identificação da estação |

A inclusão de uma categoria na tabela não implica que todos os seus exemplos sejam campos independentes em cada registro do Supabase. O inventário efetivo do esquema será realizado na EXP05.

### 3.2 Transformação, enriquecimento e redundância

**Transformação** designa uma operação que modifica a representação ou produz um indicador a partir de dados existentes. **Enriquecimento** designa a incorporação de atributos ou contexto que permitem novas consultas, interpretações ou funções. **Redundância** ocorre quando atributos acrescentam pouca informação funcional além de outros já disponíveis.

Uma média móvel e a leitura instantânea, por exemplo, são relacionadas, mas não equivalentes: a primeira caracteriza o comportamento recente e a segunda descreve o instante. Já transmitir diversas representações numéricas do mesmo valor pode ampliar o payload sem benefício correspondente.

### 3.3 Qualidade da informação

A avaliação deve considerar, conforme aplicável, **proveniência**, **unidade**, **janela temporal**, **atualidade**, **validade**, **reprodutibilidade** e **utilidade para uma função identificável**. Indicadores derivados não superam automaticamente as limitações metrológicas dos sensores de origem. Uma classificação ambiental também não equivale a uma previsão validada.

---

## 4. Arquitetura e transformações existentes

### 4.1 Fontes e variáveis de entrada

O hardware documentado utiliza:

- **BMP180:** temperatura e pressão atmosférica;
- **DHT11:** umidade relativa e temperatura auxiliar;
- **Relógio e histórico local:** instantes de amostragem e amostras anteriores;
- **Configurações do dispositivo:** parâmetros necessários a determinadas correções e regras;
- **Open-Meteo:** referência meteorológica externa consultada pelo ESP32 quando há conectividade.

A temperatura canônica da telemetria Cloud foi documentada como proveniente do BMP180. Para fins da EXP05, será necessário identificar exatamente quais valores são usados por cada transformação, incluindo unidade, frequência e eventuais regras de validação.

### 4.2 Operações locais

| Família | Transformação ou função documentada | Dependência principal | Produto esperado |
|---|---|---|---|
| Correção física | Pressão equivalente ao nível do mar | Pressão, temperatura e altitude configurada | Indicador corrigido |
| Cálculo psicrométrico | Ponto de orvalho | Temperatura e umidade | Indicador derivado |
| Agregação temporal | Média móvel de 15 minutos | Histórico de leituras | Valor suavizado |
| Resumo temporal | Mínimos e máximos diários | Histórico e referência temporal | Extremos observados |
| Tendência | Análise/regressão da pressão | Série temporal de pressão | Tendência barométrica |
| Interpretação | Classificação da umidade e conforto | Leituras e regras | Estado categórico |
| Análise contextual | Avaliação de instabilidade e estado ambiental | Indicadores e regras | Classificação contextual |
| Detecção | Anomalias, variações rápidas e eventos | Leituras, histórico e limiares | Evento ou alerta |
| Comparação externa | Diferenças em relação à referência meteorológica | Medição local e Open-Meteo | Indicador comparativo, quando disponível |

Esta tabela descreve **funções existentes na documentação do projeto**; não é uma auditoria linha a linha do firmware nem comprova que cada função esteja presente no payload de todos os ciclos. A EXP05 deverá produzir o inventário verificável dos campos e dependências reais.

### 4.3 Saídas e consumidores

```text
BMP180 / DHT11 + histórico + parâmetros
                  |
                  v
         Aquisição / validação
                  |
                  v
       Transformações no ESP32
          /        |        \
         v         v         v
   Indicadores   Estados   Eventos
         \         |         /
          \        |        /
           v       v       v
         Dashboard local
                  |
                  +----> Seleção/serialização de telemetria
                                   |
                                   v
                             Supabase / Cloud

Open-Meteo ---> referência externa (dependente de conectividade)
```

O diagrama representa relações funcionais, não a sequência exata de chamadas do firmware. Os dados externos podem ficar desatualizados durante indisponibilidade de rede; essa condição deverá ser sinalizada ou controlada na análise.

---

## 5. Indicadores propostos para a M5

**Todos os indicadores desta seção são definições de medição propostas, e não resultados da EXP05.**

### 5.1 Inventário e cobertura das transformações

Para cada saída identificada, registrar: nome do campo, tipo, unidade, origem, transformação, parâmetros, janela temporal, consumidor, periodicidade e comportamento quando a entrada é inválida ou ausente.

Um indicador descritivo possível é a cobertura do inventário:

$$
C_{\mathrm{inventario}} = \frac{N_{\mathrm{campos\ documentados}}}{N_{\mathrm{campos\ identificados}}}\times 100\%
$$

Esse percentual mede **completude da documentação**, não qualidade da informação.

### 5.2 Expansão de atributos

Definir antes do teste um conjunto de **entradas primitivas distintas** e um conjunto de **saídas de interesse**, evitando contar duas vezes aliases, metadados e referências externas.

$$
F_{\mathrm{expansao}} = \frac{N_{\mathrm{saidas}}}{N_{\mathrm{entradas}}}
$$

$$
\Delta N = N_{\mathrm{saidas}} - N_{\mathrm{entradas}}
$$

A referência informal de aproximadamente quatro valores de sensores e cerca de 60 campos de telemetria **não foi validada como contagem homogênea para a M5**. Os grupos podem incluir tipos distintos, e a razão resultante não deve ser apresentada como ganho informacional.

### 5.3 Custo computacional incremental

Quando for possível medir dois cenários comparáveis, com as mesmas entradas e condições:

$$
\Delta t_{\mathrm{Edge}} = t_{\mathrm{enriquecido}} - t_{\mathrm{essencial}}
$$

$$
\Delta H = H_{\mathrm{essencial}} - H_{\mathrm{enriquecido}}
$$

Aqui, $H$ representa o heap livre medido sob condições equivalentes; um valor positivo de $\Delta H$ indica menor heap livre no cenário enriquecido. A comparação deve considerar alocações transitórias, heap mínimo e variação natural da execução. Não é válido subtrair medições de firmware, rede ou carga de trabalho diferentes sem controle.

### 5.4 Custo de comunicação

Para payloads JSON produzidos a partir **da mesma leitura e com a mesma política de serialização**:

$$
\Delta B = B_{\mathrm{enriquecido}} - B_{\mathrm{essencial}}
$$

$$
O_{\mathrm{payload}} = \frac{\Delta B}{B_{\mathrm{essencial}}}\times 100\%
$$

Onde $B$ é o tamanho em bytes do corpo JSON. Esse indicador **não inclui** cabeçalhos HTTP, TLS, retransmissões ou custos de conexão. Uma redução de payload não equivale automaticamente à redução proporcional de tráfego de rede ou energia.

Para avaliar transmissão seletiva, poderá ser definida uma terceira condição, na qual somente um subconjunto justificado de indicadores é enviado, preservando a disponibilidade local dos demais. Essa política **ainda não foi implementada ou demonstrada como resultado da M5**.

### 5.5 Utilidade funcional

A utilidade não deve ser representada apenas por uma razão numérica de campos. Propõe-se uma **matriz de rastreabilidade funcional**:

| Indicador derivado | Pergunta que responde | Função local que utiliza | Evidência de uso | Necessário na Cloud? |
|---|---|---|---|---|
| Média móvel | Qual o comportamento recente? | Visualização/análise temporal | A verificar | A avaliar |
| Tendência da pressão | A pressão está subindo ou caindo? | Estado/tendência | A verificar | A avaliar |
| Ponto de orvalho | Qual a condição psicrométrica estimada? | Indicador ambiental | A verificar | A avaliar |
| Estado ambiental | Qual classificação resulta das regras? | Dashboard/alertas | A verificar | A avaliar |
| Evento de variação | Houve alteração relevante segundo limiar? | Alerta local | A verificar | A avaliar |

O preenchimento exige inspeção do firmware, dos campos transmitidos e das interfaces. **Não se atribuirá uma nota de qualidade ou ganho percentual sem um critério externo previamente definido.**

---

## 6. Metodologia experimental proposta

### 6.1 Condições e cenários

Propõem-se três cenários comparáveis:

| Cenário | Processamento local | Payload | Finalidade |
|---|---|---|---|
| A — Essencial | Aquisição e tratamento mínimo necessário | Campos primitivos e metadados indispensáveis | Referência de custo |
| B — Enriquecido | Processamento atual, com indicadores derivados | Esquema completo da implementação testada | Caracterizar o comportamento atual |
| C — Seletivo (opcional) | Mesmo processamento de B | Subconjunto justificado de indicadores | Estudar redução de transmissão sem perder funções locais |

**Importante:** os cenários A e C são configurações **propostas para teste**. Não se deve afirmar que já existem modos alternáveis no firmware. Para evitar comprometer o funcionamento da estação, recomenda-se inicialmente construir payloads alternativos em ambiente de teste, a partir da mesma amostra, sem alterar a telemetria de produção.

### 6.2 Instrumentação e coleta

Registrar, no mínimo:

- identificação da versão do firmware, data e configuração do teste;
- sensores, parâmetros de correção e janela histórica disponível;
- contagem e classificação dos campos de entrada e saída;
- duração das etapas de processamento, preferencialmente em microssegundos;
- heap livre e heap mínimo, com pontos de amostragem consistentes;
- tamanho dos JSONs em bytes, medido antes do envio;
- presença de valores ausentes, inválidos ou desatualizados;
- quais funções do dashboard e dos alertas utilizam cada atributo;
- condições de Wi-Fi e estado da fila de reenvio, se houver.

As métricas M1, M2 e M3 já fornecem instrumentação e referências úteis, mas **não substituem uma comparação controlada específica da EXP05**. Os resultados de experimentos distintos não devem ser tratados como amostras pareadas.

### 6.3 Procedimento EXP05

1. **Congelar a referência:** identificar commit, firmware, esquema de telemetria e parâmetros da estação.
2. **Inventariar os campos:** mapear as variáveis adquiridas, derivadas, operacionais e externas.
3. **Mapear dependências:** identificar fórmulas, janelas, limiares e consumidores de cada saída.
4. **Definir condições comparáveis:** estabelecer cenários A/B e, se viável, C, com entradas idênticas.
5. **Instrumentar tempos e memória:** medir apenas os blocos pertinentes e preservar logs brutos.
6. **Medir payloads:** serializar alternativas sobre a mesma amostra e contar bytes, sem duplicar envios de produção.
7. **Executar repetições:** incluir início com histórico incompleto e regime com histórico estabilizado.
8. **Avaliar utilidade:** comprovar quais saídas são utilizadas em visualizações, estados e alertas.
9. **Consolidar:** calcular estatísticas, registrar exceções e relacionar os achados às métricas M1–M4.
10. **Validar reprodutibilidade:** documentar código, comandos, versões e artefatos suficientes para repetir a experiência.

### 6.4 Tratamento estatístico

Para tempos, tamanhos e memória, registrar contagem de amostras, média, mediana, mínimo, máximo e dispersão quando houver repetições suficientes. Em comparações pareadas, apresentar a distribuição das diferenças por ciclo, e não apenas a diferença entre médias globais. Separar fases de aquecimento, falhas de sensor, períodos de desconexão e eventos de replay quando afetarem a comparação.

A duração e o número de repetições devem ser definidos antes da campanha, considerando a variabilidade observada nos testes preliminares. Não há amostragem EXP05 disponível para estabelecer aqui intervalos de confiança ou significância estatística.

---

## 7. Plano de registro dos resultados

**Estado da seção: AGUARDANDO EXECUÇÃO DA EXP05.** As tabelas abaixo são modelos de preenchimento; não contêm resultados observados.

### 7.1 Inventário

| Categoria | Quantidade verificada | Evidência |
|---|---:|---|
| Entradas primitivas distintas | Pendente | Inspeção do firmware |
| Indicadores numéricos derivados | Pendente | Mapeamento do esquema |
| Estados e classificações | Pendente | Regras implementadas |
| Eventos e alertas | Pendente | Código/logs |
| Metadados operacionais | Pendente | Payload real |
| Campos de referência externa | Pendente | Payload e origem |

### 7.2 Custos e comparação

| Indicador | Cenário A | Cenário B | Cenário C (opcional) |
|---|---:|---:|---:|
| Tempo Edge por ciclo (µs) | Pendente | Pendente | Pendente |
| Heap livre/mínimo (bytes) | Pendente | Pendente | Pendente |
| Payload JSON (bytes) | Pendente | Pendente | Pendente |
| Campos enviados (quantidade) | Pendente | Pendente | Pendente |
| Funções locais preservadas | Pendente | Pendente | Pendente |

### 7.3 Evidências complementares disponíveis

Há resultados de outras campanhas, como tempo de processamento Edge inferior a 1 ms em ciclos observados e payload JSON próximo de 1,9 KB em uma execução da EXP03a. Esses números são **contexto proveniente de M1–M3**, não resultados da EXP05, e não permitem calcular, isoladamente, o custo de enriquecimento. Consultar os relatórios individuais para condições e limites das medições.

---

## 8. Discussão prevista e hipóteses

As hipóteses abaixo orientam o experimento e **não constituem conclusões**:

- **H1 — Capacidade funcional:** indicadores temporais e classificações permitem funções locais que não seriam reproduzidas por uma única leitura instantânea sem processamento adicional.
- **H2 — Custo computacional:** o enriquecimento acrescenta custo de CPU e memória mensurável, cuja magnitude precisa ser determinada sob condições controladas.
- **H3 — Custo de comunicação:** transmitir campos derivados aumenta o payload em comparação com transmitir apenas campos essenciais, caso os demais parâmetros de serialização permaneçam constantes.
- **H4 — Seleção de atributos:** pode ser possível manter todas as funções locais e transmitir menos atributos à Cloud, desde que as necessidades do histórico e do dashboard remoto sejam explicitadas.

O experimento poderá refutar ou qualificar essas hipóteses. Não há garantia de que uma estratégia seletiva produza ganho operacional relevante quando o overhead de protocolo dominar o tráfego.

---

## 9. Limitações e ameaças à validade

1. **Contagem heterogênea:** misturar medições, metadados, campos externos e atributos derivados infla artificialmente fatores de expansão.
2. **Dependência temporal:** médias, tendências e extremos dependem de histórico e podem ter comportamento diferente após reinicialização.
3. **Precisão de origem:** indicadores calculados herdam incertezas e limitações dos sensores BMP180 e DHT11.
4. **Contexto externo:** Open-Meteo pode representar outro ponto, altitude ou instante, além de ficar indisponível durante falhas de rede.
5. **Instrumentação:** logs seriais e medidores adicionados podem alterar os tempos e o uso de memória.
6. **Comparabilidade:** alterar o firmware para desativar algoritmos pode modificar compilação, alocação e fluxo de execução.
7. **Semântica do payload:** campos nulos, nomes, precisão decimal e formatação JSON afetam bytes sem alterar necessariamente a utilidade.
8. **Telemetria versus rede:** bytes do corpo JSON não representam o tráfego completo de HTTP/TLS/Wi-Fi.
9. **Utilidade não validada:** um indicador utilizado no dashboard não é, por isso, automaticamente preciso, preditivo ou útil para decisões reais.
10. **Interação com resiliência:** armazenamento e reenvio podem alterar o volume de comunicação e os recursos consumidos durante a recuperação.

---

## 10. Próximos passos e critérios de conclusão

A M5 poderá ser considerada experimentalmente documentada quando houver:

- inventário verificável de entradas, transformações, saídas e consumidores;
- versão de firmware e condições da EXP05 identificadas;
- medições reproduzíveis dos cenários comparáveis;
- quantificação de tempos, memória e payload com amostras e dispersão;
- matriz de utilidade funcional preenchida com evidências;
- discussão explícita dos resultados, das hipóteses e das limitações;
- referências cruzadas consistentes com M1, M2, M3 e M4.

Até lá, o documento permanece classificado como **protocolo experimental**, e não relatório de resultados concluídos. Uma eventual implementação de TinyML constitui evolução futura e não deve ser confundida com as transformações determinísticas atualmente avaliadas.

---

## 11. Referências e documentos relacionados

### Documentação do projeto

- [README — Avaliação experimental das métricas](README.md).
- [M1 — Latência](01-latencia.md).
- [M2 — Recursos computacionais](02-recursos-computacionais.md).
- [M3 — Comunicação](03-comunicacao.md).
- [M4 — Resiliência](04-resiliencia.md).
- [Arquitetura da estação](../02-arquitetura.md).
- [Hardware e sensores](../03-hardware.md).
- [Firmware](../04-firmware.md).
- [Dashboard local](../05-dashboard-local.md).
- [Integração Cloud](../07-cloud.md).
- [Processamento Edge](../11-processamento-edge.md).
- [Particionamento da Flash](../08-particionamento-flash.md).

### Referências técnicas a consultar durante a execução

- Documentação dos sensores BMP180 e DHT11, para limitações de medição.
- Código-fonte e esquema efetivo do JSON de telemetria da versão experimental selecionada.
- Documentação do Arduino-ESP32 para instrumentação de tempo e memória.
- Documentação do Supabase/PostgreSQL para interpretação dos campos persistidos.

**Nota de rastreabilidade:** não foram adicionadas referências bibliográficas específicas sem verificação de autoria, edição e pertinência. A bibliografia acadêmica poderá ser consolidada após a execução da EXP05.
