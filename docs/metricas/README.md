# Avaliação experimental da arquitetura Edge → Cloud

**Projeto:** Estação Ambiental Inteligente com ESP32  
> **Escopo:** metodologia e organização das cinco métricas da Estação Ambiental ESP32. Este documento complementa o [README principal](../../README.md) e não substitui os relatórios individuais.

> **Estado:** documentação experimental em evolução; decisões de autonomia e compactação do buffer ainda abertas.

---

## Índice

- [1. Introdução](#1-introdução)
- [2. Pergunta de pesquisa e objetivos](#2-pergunta-de-pesquisa-e-objetivos)
  - [2.1 Objetivo geral](#21-objetivo-geral)
  - [2.2 Objetivos específicos](#22-objetivos-específicos)
- [3. Arquitetura sob avaliação](#3-arquitetura-sob-avaliação)
- [4. Metodologia experimental](#4-metodologia-experimental)
  - [4.1 Unidade experimental](#41-unidade-experimental)
  - [4.2 Periodicidade e janelas](#42-periodicidade-e-janelas)
  - [4.3 Instrumentação](#43-instrumentação)
  - [4.4 Procedimento e rastreabilidade](#44-procedimento-e-rastreabilidade)
- [5. Métricas de avaliação](#5-métricas-de-avaliação)
- [6. Organização dos experimentos](#6-organização-dos-experimentos)
- [7. Critérios de interpretação dos resultados](#7-critérios-de-interpretação-dos-resultados)
- [8. Evidências já obtidas e questões em aberto](#8-evidências-já-obtidas-e-questões-em-aberto)
- [9. Estrutura dos documentos](#9-estrutura-dos-documentos)
- [10. Reprodutibilidade e evolução](#10-reprodutibilidade-e-evolução)
- [11. Referências técnicas iniciais](#11-referências-técnicas-iniciais)

---

## 1. Introdução

A estação ambiental utiliza um microcontrolador ESP32 para adquirir variáveis meteorológicas, executar processamento local e disponibilizar informações tanto em uma interface local quanto em serviços remotos. A arquitetura combina sensores físicos (DHT11 e BMP180), processamento na borda, armazenamento local LittleFS, conectividade Wi-Fi, persistência remota no Supabase e visualização em dashboard hospedado na Vercel. Informações meteorológicas externas obtidas por meio do Open-Meteo complementam as leituras locais quando há conectividade.

O processamento na borda inclui operações como médias móveis, cálculo de indicadores derivados, análise contextual, avaliação de tendências e identificação de variações. O projeto oferece, portanto, um caso experimental para investigar os benefícios e os custos de deslocar parte do processamento para um dispositivo com recursos limitados.

A avaliação não parte do pressuposto de que a computação de borda seja superior em todas as dimensões. O objetivo é quantificar seu comportamento, seus compromissos e suas limitações sob condições controladas.

---

## 2. Pergunta de pesquisa e objetivos

**Pergunta orientadora:** em que medida o processamento local em um ESP32 contribui para a capacidade de resposta, a viabilidade computacional, o uso da comunicação, a continuidade operacional e a transformação dos dados de uma estação ambiental conectada à nuvem?

### 2.1 Objetivo geral

Caracterizar experimentalmente o desempenho e a resiliência de uma arquitetura Edge → Cloud aplicada ao monitoramento ambiental com ESP32.

### 2.2 Objetivos específicos

1. Medir o tempo gasto nas etapas de aquisição, processamento local e comunicação remota.
2. Quantificar o consumo de recursos computacionais do firmware e dos algoritmos na borda.
3. Caracterizar o volume e a frequência das operações de comunicação.
4. Avaliar a continuidade do processamento e a recuperação de registros em situações de indisponibilidade da rede.
5. Investigar a transformação de leituras brutas em informações derivadas e o potencial de estratégias de transmissão seletiva.

---

## 3. Arquitetura sob avaliação

O fluxo funcional de referência é:

```text
Sensores DHT11 / BMP180
          |
          v
       ESP32
  aquisição e validações
  processamento Edge
  análise contextual
          |
          +----> Dashboard local (LittleFS / servidor web)
          |
          +----> Buffer persistente LittleFS (quando necessário)
          |                 |
          +-----------------+----> Wi-Fi / HTTPS ----> Supabase
                                                   |
                                                   v
                                            Dashboard remoto
                                                (Vercel)

Open-Meteo ----> consulta externa pelo ESP32, quando disponível
```

O desenho é funcional e simplificado: não pretende representar todos os módulos internos, dependências, políticas de atualização OTA ou fluxos de autenticação. A indisponibilidade da rede também pode afetar a atualização dos dados externos do Open-Meteo; isso não deve ser confundido com perda de leituras produzidas pelos sensores locais.

---

## 4. Metodologia geral

### 4.1 Unidade experimental

A unidade experimental é uma estação ESP32 operando com o firmware instrumentado. Os testes realizados até aqui ocorreram predominantemente em ambiente interno doméstico, condição que limita a extrapolação de resultados para uma implantação meteorológica urbana.

### 4.2 Periodicidade e janelas

A telemetria remota é produzida aproximadamente a cada minuto. Algumas rotinas de análise utilizam uma janela histórica de até 60 amostras. A consulta aos dados externos do Open-Meteo ocorre em periodicidade própria, tipicamente de 15 minutos na configuração discutida.

Os tempos e frequências devem ser confirmados para cada versão de firmware utilizada, pois o agendamento efetivo pode variar com a conectividade e as operações de rede.

### 4.3 Instrumentação

Os experimentos utilizam medições e contadores incorporados ao firmware, com apresentação pelo Monitor Serial, complementados por verificações no Supabase e no dashboard remoto. São observados, conforme a métrica: duração de operações, uso de heap, tamanho do firmware, tamanho do payload JSON, tentativas e respostas HTTP, ocupação do LittleFS, registros pendentes, recuperados e não armazenados.

### 4.4 Procedimento e rastreabilidade

Cada relatório de métrica deverá identificar:

- versão exata do firmware e configuração de partições;
- ambiente e condições de execução;
- sequência de comandos e duração do experimento;
- instrumentos e definição operacional de cada indicador;
- resultados brutos e cálculos derivados;
- limitações, anomalias e ameaças à validade;
- referências aos registros, capturas e consultas de verificação.

As versões instrumentadas são experimentais e não devem ser confundidas automaticamente com versões de produção.

---

## 5. Métricas de avaliação

| Métrica | Dimensão | Indicadores centrais | Limite de interpretação |
|---|---|---|---|
| **M1 — Latência** | Tempo de resposta | Aquisição, processamento Edge e operação HTTPS | O tempo de POST não representa, isoladamente, a latência ponta a ponta de visualização no dashboard nem uma execução equivalente na nuvem. |
| **M2 — Recursos computacionais** | Viabilidade no ESP32 | Flash, RAM/heap, tempo de execução de rotinas | Uso de heap livre não substitui análise de fragmentação ou consumo de energia. |
| **M3 — Comunicação** | Custo de transmissão | Bytes do payload, frequência de envios, sucesso/falha | O tamanho do JSON não inclui necessariamente overhead HTTP, TLS, TCP/IP e retransmissões. |
| **M4 — Resiliência** | Continuidade e recuperação | Leituras locais, fila persistente, perdas, tempo de recuperação | Reenvio HTTP 201 não comprova, por si só, ausência de duplicidades ou integridade de todos os campos. |
| **M5 — Transformação dos dados** | Enriquecimento e seletividade | Dados brutos, indicadores derivados, potencial de redução | Produzir mais atributos não equivale a economizar banda; redução efetiva requer estratégia implementada e comparação controlada. |

---

## 6. Organização dos experimentos

A identificação dos experimentos segue a nomenclatura efetivamente usada no firmware, que não precisa coincidir com a numeração das métricas:

| Identificador | Foco principal | Estado resumido |
|---|---|---|
| `EXP01b` | Instrumentação do processamento Edge | Medições iniciais realizadas |
| `EXP02a` | Tempo de operação HTTPS com a nuvem | Medições iniciais realizadas |
| `EXP03a` | Volume de payload e tentativas de comunicação | Medições iniciais realizadas |
| `EXP04a` | Resiliência sem buffer durante Wi-Fi OFF | Testado |
| `EXP04b.1` | Diagnóstico de capacidade do LittleFS | Testado |
| `EXP04b.2` | Buffer persistente e reenvio automático | Testes funcionais e prolongados realizados; melhorias em aberto |
| `EXP05` | Avaliação sistemática da transformação dos dados | A desenvolver/complementar |

A nomenclatura acima não implica que todas as métricas estejam concluídas em sua totalidade.

---

## 7. Critérios de interpretação dos resultados

Os relatórios devem distinguir explicitamente:

- **Medido:** valor registrado por instrumento, log ou consulta verificável.
- **Calculado:** valor obtido por fórmula aplicada a medições identificadas.
- **Estimado:** aproximação dependente de hipóteses explícitas.
- **Projetado:** comportamento esperado de uma solução ainda não implementada ou testada.
- **Não verificado:** hipótese ou propriedade que exige experimento adicional.

As comparações entre Edge e Cloud devem observar equivalência funcional. Comparar microssegundos de um algoritmo local com milissegundos de uma operação HTTPS evidencia diferentes custos operacionais, mas não constitui comparação direta entre duas implementações equivalentes do mesmo algoritmo.

Da mesma forma, a continuidade do processamento Edge durante uma interrupção não implica preservação ilimitada das medições: a capacidade do armazenamento é finita.

---

## 8. Evidências já obtidas e questões em aberto

As primeiras instrumentações indicaram processamento local da ordem de centenas de microssegundos, enquanto operações HTTPS frequentemente exigiram tempos da ordem de segundos. Esses valores são observações preliminares, sujeitas à configuração e às condições do experimento.

Na avaliação de resiliência, a implementação `EXP04b.2` demonstrou gravação local durante a indisponibilidade do Wi-Fi, reconhecimento de registros após reinicialização e reenvio automático. Em um teste prolongado, observou-se uma fila com 119 registros pendentes, seguida de limitação de espaço e perdas de novas leituras. O relatório final do firmware indicou fila esvaziada, 34 leituras não armazenadas e uma falha de tentativa de reenvio. Os contadores possuem escopos próprios e não devem ser combinados sem verificar suas definições.

**Decisões ainda abertas:** autonomia-alvo do buffer (por exemplo, 2, 6 ou 12 horas), representação JSON versus formato compacto, política de descarte quando a fila atingir seu limite, tratamento de dados externos desatualizados e prevenção de duplicidades após confirmações HTTP ambíguas. A capacidade nominal de 120 registros não deve ser descrita como garantia de duas horas em qualquer condição.

---

## 9. Estrutura dos documentos

```text
docs/
└── metricas/
    ├── README.md
    ├── 01-latencia.md
    ├── 02-recursos-computacionais.md
    ├── 03-comunicacao.md
    ├── 04-resiliencia.md
    └── 05-transformacao-dados.md
```

- [M1 — Latência](01-latencia.md)
- [M2 — Recursos computacionais](02-recursos-computacionais.md)
- [M3 — Comunicação](03-comunicacao.md)
- [M4 — Resiliência](04-resiliencia.md)
- [M5 — Transformação dos dados](05-transformacao-dados.md)

Os links passam a funcionar após a criação dos respectivos arquivos. Cada documento deverá seguir, sempre que aplicável, o mesmo roteiro: fundamentação, objetivos, ambiente, metodologia, resultados, discussão, limitações e conclusões.

---

## 10. Reprodutibilidade e evolução

A documentação será atualizada incrementalmente. Mudanças no firmware ou na política de armazenamento deverão resultar em identificação explícita da versão experimental, para evitar misturar resultados de implementações distintas. Dados brutos, consultas SQL e capturas devem ser preservados em locais apropriados, sem publicar credenciais, tokens ou outras informações sensíveis.

A consolidação acadêmica das cinco métricas será realizada após a conclusão dos relatórios individuais e das verificações pendentes.

---

## 11. Referências técnicas iniciais

- Espressif Systems. **ESP-IDF Programming Guide**. https://docs.espressif.com/projects/esp-idf/en/stable/esp32/
- LittleFS Project. **littlefs: A little fail-safe filesystem designed for microcontrollers**. https://github.com/littlefs-project/littlefs
- Supabase. **Documentation**. https://supabase.com/docs
- Open-Meteo. **Documentation**. https://open-meteo.com/en/docs

> **Nota editorial:** estas são referências técnicas iniciais. A bibliografia acadêmica sobre Edge Computing, observabilidade e resiliência será aprofundada nos documentos específicos, com referências verificadas e associadas às afirmações que fundamentarem.
