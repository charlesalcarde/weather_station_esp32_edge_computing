# M1 — Latência da arquitetura Edge → Cloud

**Projeto:** Estação Ambiental Inteligente com ESP32  
**Documento:** `docs/metricas/01-latencia.md`  
**Instrumentações:** EXP01b (processamento local) e EXP02a (operação HTTPS)  
**Estado:** resultados experimentais iniciais; avaliação ponta a ponta ainda não concluída.

> **Escopo:** caracterizar os tempos de aquisição, processamento local e envio de telemetria. O tempo de uma operação HTTPS **não** equivale ao tempo de execução do mesmo algoritmo na nuvem, nem à latência completa até a atualização do dashboard.

---

## Índice

- [1. Introdução](#1-introdução)
- [2. Objetivos e perguntas de avaliação](#2-objetivos-e-perguntas-de-avaliação)
- [3. Fundamentação e definição dos indicadores](#3-fundamentação-e-definição-dos-indicadores)
  - [3.1 Etapas da arquitetura](#31-etapas-da-arquitetura)
  - [3.2 Indicadores e unidades](#32-indicadores-e-unidades)
  - [3.3 Comparabilidade das medidas](#33-comparabilidade-das-medidas)
- [4. Ambiente e instrumentação](#4-ambiente-e-instrumentação)
  - [4.1 Configuração experimental](#41-configuração-experimental)
  - [4.2 EXP01b — processamento Edge](#42-exp01b--processamento-edge)
  - [4.3 EXP02a — operação HTTPS](#43-exp02a--operação-https)
- [5. Metodologia e procedimento](#5-metodologia-e-procedimento)
- [6. Resultados experimentais](#6-resultados-experimentais)
  - [6.1 Aquisição e processamento Edge](#61-aquisição-e-processamento-edge)
  - [6.2 Operação HTTPS](#62-operação-https)
  - [6.3 Exemplos de interpretação](#63-exemplos-de-interpretação)
- [7. Discussão](#7-discussão)
- [8. Limitações e ameaças à validade](#8-limitações-e-ameaças-à-validade)
- [9. Próximos experimentos](#9-próximos-experimentos)
- [10. Conclusões parciais](#10-conclusões-parciais)
- [11. Referências e documentos relacionados](#11-referências-e-documentos-relacionados)

---

## 1. Introdução

A Estação Ambiental Inteligente utiliza um ESP32 para adquirir dados dos sensores DHT11 e BMP180, executar algoritmos de processamento ambiental localmente e encaminhar telemetria ao Supabase por HTTPS. Um dashboard local apresenta informações diretamente a partir do dispositivo, enquanto um dashboard remoto, hospedado na Vercel, consulta os dados persistidos na nuvem. Informações externas do Open-Meteo complementam a análise quando disponíveis.

A Métrica M1 investiga o comportamento temporal dessas operações. Seu propósito não é pressupor superioridade da borda, mas identificar **quais etapas são executadas localmente**, quanto tempo consomem e onde a comunicação introduz dependência de infraestrutura externa.

Esta avaliação integra o programa de cinco métricas apresentado no [README das métricas](README.md).

## 2. Objetivos e perguntas de avaliação

**Objetivo geral:** caracterizar os tempos observados na aquisição, no processamento Edge e na operação de envio HTTPS da estação ambiental.

**Objetivos específicos:**

1. Medir a duração da aquisição dos sensores e separá-la do custo dos algoritmos locais.
2. Caracterizar o tempo de processamento Edge e seu comportamento durante o preenchimento da janela temporal.
3. Medir a duração da operação HTTPS de telemetria e sua variabilidade.
4. Identificar os componentes ainda não instrumentados do caminho até a visualização remota.
5. Definir condições para comparações futuras funcionalmente equivalentes.

**Perguntas orientadoras:** quanto tempo o dispositivo dedica à aquisição e à análise local? Qual é a ordem de grandeza do envio HTTPS? Quais parcelas da latência de visualização ainda não foram medidas?

## 3. Fundamentação e definição dos indicadores

### 3.1 Etapas da arquitetura

```text
DHT11 / BMP180
      │
      ▼
Aquisição dos sensores ──► Processamento Edge ──► estado/alertas locais
                                  │
                                  ▼
                         Serialização da telemetria
                                  │
                                  ▼
                         Operação HTTPS POST
                                  │
                                  ▼
                           Supabase / banco
                                  │
                                  ▼
                       Consulta do dashboard remoto
                                  │
                                  ▼
                           Renderização no navegador
```

As etapas são conceitualmente distintas. O tempo de aquisição depende, entre outros fatores, da interface e do comportamento dos sensores; o processamento Edge depende dos algoritmos e do tamanho das janelas; o envio HTTPS depende da pilha de comunicação, da rede e do serviço remoto.

### 3.2 Indicadores e unidades

| Indicador | Símbolo | Definição operacional | Unidade | Situação |
|---|---|---|---|---|
| Aquisição | `T_aquisicao` | Intervalo instrumentado de leitura dos sensores | µs / ms | Medido — EXP01b |
| Processamento Edge | `T_edge` | Intervalo instrumentado de execução do pipeline local, excluída a aquisição | µs / ms | Medido — EXP01b |
| Operação HTTPS | `T_https` | Intervalo entre o início da instrumentação da requisição e o encerramento da operação HTTP | ms | Medido — EXP02a |
| Recebimento e persistência remota | `T_persistencia` | Tempo até a confirmação efetiva de persistência, conforme definição a estabelecer | ms | Não isolado |
| Disponibilização no dashboard | `T_dashboard` | Tempo entre a leitura e a exibição atualizada no navegador | ms / s | Não medido ponta a ponta |
| Resposta local ao evento | `T_alerta_local` | Tempo entre a ocorrência física e a indicação local | ms / s | Não medido ponta a ponta |

A conversão entre unidades é `1 ms = 1.000 µs`.

Como referência **conceitual**, uma latência ponta a ponta poderia ser decomposta em aquisição, processamento, preparação, comunicação, persistência, consulta e renderização. **Não se deve somar automaticamente os tempos medidos** para obter essa latência: as fronteiras instrumentadas, o escalonamento das tarefas, a frequência de atualização e possíveis sobreposições precisam ser estabelecidos antes.

### 3.3 Comparabilidade das medidas

`T_edge` mede trabalho computacional local. `T_https` mede uma operação de comunicação com um serviço remoto. Embora possam ser apresentados lado a lado para caracterizar a arquitetura, **não representam duas implementações do mesmo algoritmo**. Portanto, a razão `T_https / T_edge` não deve ser divulgada como *speedup* Edge versus Cloud.

## 4. Ambiente e instrumentação

### 4.1 Configuração experimental

| Elemento | Configuração observada |
|---|---|
| Plataforma | ESP32 Dev Module |
| Sensores locais | DHT11 e BMP180 |
| Processamento | Médias móveis, ponto de orvalho, regressão de pressão, análise contextual, históricos, derivadas e verificações |
| Janela histórica | Até 60 amostras |
| Ciclo nominal de leitura | Aproximadamente 60 s |
| Comunicação | Wi-Fi e HTTPS |
| Destino da telemetria | Supabase |
| Visualização | Dashboard local e dashboard remoto na Vercel |
| Firmware de referência | v3.6.7, com instrumentações incrementais EXP01b e EXP02a |
| Instrumento de observação | Monitor Serial e contadores no firmware |

Os valores reportados neste documento provêm das saídas experimentais compartilhadas durante o desenvolvimento. Não constituem, por si, um conjunto bruto de amostras completo ou uma campanha estatística controlada.

### 4.2 EXP01b — processamento Edge

O firmware instrumentado utiliza `micros()` para medir intervalos de execução. O relatório serial apresenta, entre outros itens:

- Aquisição dos sensores;
- Médias móveis e ponto de orvalho;
- Regressão de pressão e análise contextual;
- Preparação, históricos, mínimos, máximos e eventos;
- Derivadas, variações e verificações de saltos;
- Tempo residual/overhead e processamento Edge total;
- Quantidade de amostras na janela, ciclo, heap e uptime.

O **tempo total Edge exclui a aquisição dos sensores** na delimitação adotada pela instrumentação. As subetapas não devem ser tratadas como medições de CPU isoladas de qualquer interferência; são durações observadas nos trechos instrumentados.

### 4.3 EXP02a — operação HTTPS

A implementação EXP02a utiliza `millis()` para cronometrar a operação HTTPS: o início ocorre antes de `http.begin(...)` e o término após `http.end()`. O trecho inclui a execução da requisição `POST` e o tratamento da resposta dentro dessa operação, mas **não inclui** a associação inicial ao Wi-Fi, a preparação do JSON nem uma decisão ambiental executada remotamente.

O firmware registra tentativas, sucessos, falhas, código HTTP e, para operações bem-sucedidas, mínimo, máximo e média desde a inicialização. Os códigos HTTP `200`, `201` e `204` são tratados como sucesso nessa instrumentação. A média exibida não é uma média de todas as tentativas, mas das operações consideradas bem-sucedidas.

> **Nota de implementação:** a versão de firmware examinada utiliza `WiFiClientSecure` com `setInsecure()`. Essa escolha é pertinente à avaliação de segurança da comunicação, mas não é objeto de comparação experimental de latência neste documento. Não se deve inferir que o tempo observado representa uma configuração TLS com validação completa de certificados.

## 5. Metodologia e procedimento

O procedimento adotado para as medições iniciais foi:

1. Inicializar a estação com a versão instrumentada do firmware e confirmar o funcionamento dos sensores e da rede.
2. Observar os relatórios `BENCHMARK EDGE - EXP01b` em diferentes ciclos, anotando a quantidade de amostras na janela.
3. Observar os relatórios `BENCHMARK CLOUD - EXP02a`, registrando duração, código HTTP, sucesso/falha e estatísticas acumuladas.
4. Diferenciar a fase de preenchimento da janela de 60 amostras da fase de operação com janela completa.
5. Preservar a identificação do firmware, as condições de rede e o número de ciclos ao comparar execuções.

**Para uma reprodução quantitativa rigorosa**, recomenda-se futuramente exportar uma série temporal de cada medição, registrar condições da rede e calcular distribuição, mediana, percentis e dispersão. Os resultados disponíveis nesta versão do documento são **observações selecionadas**, e não estimativas estatísticas populacionais.

## 6. Resultados experimentais

### 6.1 Aquisição e processamento Edge

Os seguintes registros foram observados em diferentes execuções do projeto:

| Execução / referência | Janela | Aquisição | Processamento Edge total | Observação |
|---|---:|---:|---:|---|
| EXP01b, ciclo 62 | 60/60 | 97.227 µs (97,227 ms) | 835 µs (0,835 ms) | Janela completa |
| EXP04b.2, ciclo 14 | 14/60 | 96.521 µs (96,521 ms) | 635 µs (0,635 ms) | Firmware posterior com instrumentação EXP01b |
| EXP04b.2, ciclo 169 | 60/60 | 96.524 µs (96,524 ms) | 805 µs (0,805 ms) | Operação offline com janela completa |
| EXP04b.2, ciclo 174 | 60/60 | 97.230 µs (97,230 ms) | 815 µs (0,815 ms) | Recuperação de conectividade em andamento |

**Interpretação:** nessas observações, a aquisição ficou próxima de 96–97 ms, enquanto o pipeline Edge medido consumiu menos de 1 ms. Isso não significa que a resposta completa a um evento físico ocorra em menos de 1 ms: o intervalo entre leituras, a aquisição e os mecanismos de atualização também participam da resposta efetiva.

Na instrumentação inicial, o custo da regressão de pressão aumentou durante o preenchimento da janela, estabilizando-se quando ela alcançou 60 amostras; em um registro com janela completa, a regressão consumiu aproximadamente **326 µs**. Esse comportamento reforça a necessidade de informar o estado da janela ao comparar ciclos.

### 6.2 Operação HTTPS

Em uma execução da EXP02a com **61 operações bem-sucedidas**, foram registrados:

| Indicador | Valor observado |
|---|---:|
| Última operação HTTPS | 1.845 ms |
| Média das operações bem-sucedidas | 1.842,3 ms |
| Mínimo das operações bem-sucedidas | 1.027 ms |
| Máximo das operações bem-sucedidas | 2.701 ms |
| Sucessos / tentativas | 61 / 61 |

Em outra execução, foi observado um tempo de aproximadamente **12.442 ms** para uma operação HTTPS, ilustrando a possibilidade de variações substanciais. Esse valor não pertence necessariamente à mesma série de 61 operações da tabela e **não deve ser incorporado à média acima**.

O sucesso HTTP informa que a requisição recebeu uma resposta considerada bem-sucedida pelo cliente. Não comprova, isoladamente, que o dashboard remoto já tenha atualizado a visualização.

### 6.3 Exemplos de interpretação

Para o ciclo 62, os tempos observados foram:

- Aquisição: **97,227 ms**;
- Processamento Edge: **0,835 ms**.

A soma aritmética desses dois intervalos é **98,062 ms**, representando apenas a soma das duas parcelas instrumentadas, **não** a latência completa da estação nem a atualização do dashboard.

Para a operação HTTPS, a média observada na série de 61 sucessos foi **1,8423 s**. Ela caracteriza a duração da operação de envio naquela execução, e não um processamento equivalente realizado no servidor.

## 7. Discussão

Os registros mostram que os algoritmos locais executam rapidamente em relação à aquisição dos sensores e à operação de comunicação observada. Isso sustenta a **viabilidade temporal do processamento Edge** para o conjunto de algoritmos e a periodicidade empregados na estação.

A análise local também pode continuar durante indisponibilidade de Wi-Fi, como observado nos testes da Métrica M4. Essa continuidade é uma propriedade arquitetural importante, mas **não demonstra por si só uma vantagem quantitativa de latência em comparação com um algoritmo idêntico executado na nuvem**.

Há ainda dois cuidados de interpretação:

1. **Periodicidade não é latência:** uma leitura realizada a cada ~60 s pode detectar um evento somente no ciclo seguinte, mesmo que o cálculo local leve microssegundos.
2. **Tempo de envio não é tempo de visualização:** consultas, agregações, cache, atualização do navegador e persistência remota podem acrescentar atrasos que não foram isolados pela EXP02a.

## 8. Limitações e ameaças à validade

| Limitação | Consequência | Mitigação futura |
|---|---|---|
| Amostras selecionadas do Monitor Serial | Não permitem calcular percentis ou intervalos de confiança confiáveis | Exportar medições por ciclo |
| Ambiente doméstico e rede Wi-Fi variável | Resultados sensíveis à infraestrutura e à intensidade do sinal | Repetir ensaios sob condições registradas |
| `micros()` e `millis()` como cronômetros | Resolução e overhead de instrumentação distintos | Caracterizar resolução e overhead |
| Janela temporal variável | Custo de alguns algoritmos depende do número de amostras | Separar aquecimento e regime estável |
| HTTPS inclui múltiplas operações | Não isola DNS, conexão, TLS, transmissão e resposta | Instrumentar subetapas |
| Dashboard não instrumentado ponta a ponta | Não é possível declarar latência de visualização | Correlacionar timestamps e atualizações |
| Ausência de execução equivalente na Cloud | Não é possível calcular *speedup* Edge/Cloud | Implementar algoritmo de referência no servidor |
| Sensor e algoritmo têm frequências diferentes | Tempo de cálculo não determina sozinho tempo de detecção | Medir eventos com marca temporal |

## 9. Próximos experimentos

1. **Coleta sistemática:** registrar por ciclo `T_aquisicao`, `T_edge`, `T_https`, status HTTP, janela, uptime e condições de rede, sem alterar a lógica ambiental.
2. **Distribuições:** calcular mediana, média, mínimo, máximo, desvio-padrão e percentis P50/P95/P99 para execuções com tamanho amostral explícito.
3. **Regime estável:** analisar separadamente os primeiros 60 ciclos e a operação com janela completa.
4. **Latência ponta a ponta:** correlacionar timestamp de aquisição, timestamp de inserção no Supabase e momento em que a nova leitura se torna visível no dashboard, com relógios sincronizados e definição de atualização.
5. **Resposta a eventos:** produzir uma perturbação controlada e medir o tempo entre sua ocorrência e a indicação local.
6. **Comparação funcional:** caso seja objetivo avaliar ganho de latência Edge versus Cloud, implementar a **mesma análise** em ambos os ambientes, sob entrada e condições comparáveis.

Essas atividades são propostas, não funcionalidades já validadas.

## 10. Conclusões parciais

A Métrica M1 dispõe de evidências iniciais de que o processamento ambiental local é executado na ordem de **centenas de microssegundos**, enquanto a aquisição dos sensores, nos exemplos observados, exige aproximadamente **97 ms**. A operação HTTPS apresentou tempos tipicamente na ordem de **segundos**, com variabilidade entre execuções.

Esses resultados caracterizam diferentes componentes temporais da estação e apoiam a viabilidade do processamento na borda. **Não autorizam**, nesta etapa, uma afirmação de aceleração quantitativa em relação à Cloud nem uma conclusão sobre latência ponta a ponta até o dashboard remoto.

A avaliação será ampliada quando houver séries completas e instrumentação dos segmentos ainda não medidos.

## 11. Referências e documentos relacionados

### Documentação interna

- [README das métricas](README.md) — escopo e metodologia comum.
- [README principal](../../README.md) — visão geral do projeto.
- [Arquitetura](../02-arquitetura.md) — organização dos componentes Edge e Cloud.
- [Firmware](../04-firmware.md) — implementação e operação do programa.
- [Conectividade](../06-conectividade.md) — comunicação Wi-Fi.
- [Cloud](../07-cloud.md) — persistência e serviços remotos.
- [Processamento Edge](../09-processamento-edge.md) — algoritmos e pipeline local.

### Referências técnicas

- Arduino-ESP32 / Espressif — documentação das funções de temporização `micros()` e `millis()` e das APIs de comunicação.
- Espressif Systems — documentação técnica do ESP32 e do ambiente de execução.
- Documentação do Supabase — API REST e códigos de resposta HTTP.

> **Rastreabilidade:** as observações quantitativas foram extraídas dos relatórios seriais apresentados durante os experimentos EXP01b, EXP02a e EXP04b.2. Para publicação científica, recomenda-se arquivar logs completos, firmware exato, configuração de teste e séries brutas correspondentes.
