# M3 — Comunicação da arquitetura Edge → Cloud

**Projeto:** Estação Ambiental Inteligente com ESP32  
**Documento:** `docs/metricas/03-comunicacao.md`  
**Instrumentação principal:** EXP03a — contabilização do payload JSON enviado ao Supabase  
**Estado:** caracterização experimental inicial do volume de aplicação; tráfego total de rede, retransmissões e eficiência comparativa ainda não medidos.

> **Escopo:** quantificar o volume de telemetria gerado pela estação, as tentativas de envio HTTPS, as respostas de sucesso e falha e as taxas médias de payload. O volume do JSON **não equivale** ao total de bytes efetivamente transmitidos na rede. Os resultados apresentados não comprovam, por si só, redução de banda decorrente do processamento Edge.

---

## Índice

- [1. Introdução](#1-introdução)
- [2. Objetivos e perguntas de avaliação](#2-objetivos-e-perguntas-de-avaliação)
- [3. Fundamentação e indicadores](#3-fundamentação-e-indicadores)
  - [3.1 Fluxos de comunicação](#31-fluxos-de-comunicação)
  - [3.2 Definições operacionais](#32-definições-operacionais)
  - [3.3 Indicadores e unidades](#33-indicadores-e-unidades)
- [4. Ambiente e instrumentação](#4-ambiente-e-instrumentação)
  - [4.1 Plataforma experimental](#41-plataforma-experimental)
  - [4.2 EXP03a — pontos instrumentados](#42-exp03a--pontos-instrumentados)
  - [4.3 Limites da instrumentação](#43-limites-da-instrumentação)
- [5. Metodologia experimental](#5-metodologia-experimental)
- [6. Resultados observados](#6-resultados-observados)
  - [6.1 Medições da EXP03a](#61-medições-da-exp03a)
  - [6.2 Projeções de volume](#62-projeções-de-volume)
  - [6.3 Comunicação durante a resiliência](#63-comunicação-durante-a-resiliência)
- [7. Discussão e interpretação](#7-discussão-e-interpretação)
- [8. Limitações e ameaças à validade](#8-limitações-e-ameaças-à-validade)
- [9. Próximos experimentos](#9-próximos-experimentos)
- [10. Conclusões parciais](#10-conclusões-parciais)
- [11. Referências e documentos relacionados](#11-referências-e-documentos-relacionados)

---

## 1. Introdução

A Estação Ambiental Inteligente utiliza um ESP32 para adquirir dados do BMP180 e do DHT11, executar processamento ambiental local e enviar ao Supabase um registro JSON contendo medições e informações derivadas. A estação também mantém um dashboard Web local, consulta dados externos da Open-Meteo e dispõe de atualização de firmware OTA local e remota.

A **Métrica M3 — Comunicação** caracteriza o fluxo de telemetria **ESP32 → Supabase**. Sua finalidade é medir o volume produzido pela aplicação, verificar o comportamento das requisições e construir uma referência quantitativa para futuras estratégias de seleção de atributos, compactação ou transmissão orientada a eventos.

Esta avaliação integra o programa descrito no [README das métricas](README.md) e complementa a [M1 — Latência](01-latencia.md), a [M2 — Recursos computacionais](02-recursos-computacionais.md) e a [M4 — Resiliência](04-resiliencia.md).

## 2. Objetivos e perguntas de avaliação

**Objetivo geral:** caracterizar o custo de comunicação da telemetria enviada pelo nó Edge à Cloud, identificando volume de payload, frequência de requisições, sucessos, falhas e oportunidades de otimização.

**Objetivos específicos:**

1. Medir o tamanho do JSON serializado em cada tentativa de envio ao Supabase.
2. Contabilizar tentativas de POST e respostas classificadas como sucesso ou falha.
3. Estimar o volume acumulado e a taxa média de payload durante uma execução.
4. Projetar o volume de aplicação para um dia, um mês e múltiplas estações, explicitando as hipóteses.
5. Distinguir payload de aplicação de tráfego total HTTP/TLS/TCP/IP.
6. Definir experimentos posteriores que permitam testar, de fato, estratégias de economia de comunicação.

**Perguntas orientadoras:** quantos bytes de telemetria a estação produz por ciclo? Qual o volume nominal ao longo do tempo? O enriquecimento local aumenta ou reduz o payload em relação a alternativas? Quanto da comunicação ainda não é capturado pela instrumentação atual?

## 3. Fundamentação e indicadores

### 3.1 Fluxos de comunicação

```text
BMP180 / DHT11
       │
       ▼
     ESP32 ── processamento Edge ── serialização JSON
       │                               │
       │                               ▼
       │                       POST HTTPS / REST
       │                               │
       │                               ▼
       │                        Supabase / PostgreSQL
       │                               │
       │                               ▼
       │                          Vercel / dashboard
       │
       ├──► Open-Meteo (consultas externas periódicas)
       ├──► Dashboard local (requisições HTTP na LAN)
       └──► GitHub / OTA HTTPS (manutenção do firmware)
```

O experimento **EXP03a instrumenta especificamente o payload do POST de telemetria ao Supabase**. Os demais fluxos existem na arquitetura, mas não estão incluídos no volume medido por essa instrumentação.

### 3.2 Definições operacionais

Seja `B_i` o número de bytes do JSON serializado na tentativa `i`, e `N` o número de tentativas efetivamente iniciadas:

$$
B_{\mathrm{tentado}}=\sum_{i=1}^{N}B_i
$$

Para um subconjunto `S` de tentativas cujo código HTTP foi classificado como sucesso:

$$
B_{\mathrm{sucesso}}=\sum_{i\in S}B_i
$$

A taxa média de payload tentado, em bytes por minuto, é calculada por:

$$
R_{\mathrm{payload}}=\frac{B_{\mathrm{tentado}}\times 60000}{t_{\mathrm{última\ consulta}}-t_{\mathrm{primeira\ tentativa}}}
$$

Os instantes são expressos em milissegundos. No firmware, o cálculo é efetuado com `millis()` e o intervalo se inicia na **primeira tentativa de POST**, evitando incluir o tempo anterior à primeira transmissão.

A taxa de sucesso observada pode ser definida como:

$$
P_{\mathrm{sucesso}}=\frac{N_{\mathrm{sucessos}}}{N_{\mathrm{tentativas}}}\times100\%
$$

Esse percentual caracteriza **respostas da operação HTTP na execução observada**, não disponibilidade contratual do serviço nem garantia de persistência sem duplicidades.

### 3.3 Indicadores e unidades

| Indicador | Unidade | Interpretação |
|---|---|---|
| Payload da última tentativa | bytes | Comprimento do JSON serializado entregue ao POST |
| Tentativas HTTP | contagem | POSTs iniciados pela rotina instrumentada |
| Sucessos HTTP | contagem | Respostas 200, 201 ou 204 |
| Falhas HTTP | contagem | Demais respostas ou erros após a tentativa instrumentada |
| Payload tentado acumulado | KiB | Soma dos bytes de JSON das tentativas |
| Payload com HTTP de sucesso | KiB | Soma dos bytes de JSON das tentativas aceitas |
| Taxa média de payload tentado | bytes/min | Volume acumulado dividido pelo intervalo observado |
| Tráfego total de rede | bytes | **Ainda não medido**: inclui cabeçalhos e protocolos |

Neste documento, **1 KiB = 1.024 bytes** e **1 MiB = 1.048.576 bytes**. Quando utilizados, kB e MB decimais correspondem a 1.000 e 1.000.000 bytes.

## 4. Ambiente e instrumentação

### 4.1 Plataforma experimental

| Componente | Configuração |
|---|---|
| Nó Edge | ESP32 Dev Module, Flash física de 4 MiB |
| Sensores | BMP180 e DHT11 |
| Processamento | Médias, tendências, ponto de orvalho, análise contextual, estados e eventos |
| Telemetria | JSON por HTTPS/REST |
| Destino | Supabase / PostgreSQL |
| Periodicidade nominal | Aproximadamente um POST por minuto |
| Instrumentação | EXP03a integrada ao firmware EXP01b/EXP02a/EXP03a |
| Observabilidade | Relatório no Monitor Serial |

### 4.2 EXP03a — pontos instrumentados

A leitura do sketch experimental permite identificar o seguinte fluxo:

1. O firmware monta um `JsonDocument` com as informações de telemetria.
2. A função `serializeJson(doc, payload)` produz uma `String` contendo o JSON.
3. `payload.length()` fornece o tamanho em bytes do payload serializado, na representação utilizada pelo firmware.
4. Imediatamente antes de `http.POST(payload)`, o código incrementa o contador de tentativas e acumula os bytes tentados.
5. Após a resposta, classifica como sucesso os códigos **200, 201 e 204**, incrementando os respectivos contadores e bytes associados.
6. O relatório serial apresenta payload da última tentativa, contagens, acumulados em KiB e taxa média de bytes/min.

A EXP03a foi adicionada **sem alterar deliberadamente o conteúdo do JSON** e sem introduzir uma política de redução de tráfego. Dessa forma, sua função é produzir uma linha de base (*baseline*).

### 4.3 Limites da instrumentação

O código consultado explicita que os contadores **não incluem** cabeçalhos HTTP, handshake TLS, TCP/IP, tráfego de resposta nem consultas externas. Também há um caso relevante: se `http.begin()` falhar antes de iniciar o POST, a falha pode ser contabilizada pela instrumentação de latência Cloud, mas **não entra no contador de tentativas da EXP03a**, que começa imediatamente antes do POST.

Consequentemente, os contadores de EXP02a e EXP03a não precisam coincidir em todos os cenários de erro.

## 5. Metodologia experimental

A sequência de avaliação consiste em:

1. Inicializar o firmware instrumentado e verificar conectividade com o Supabase.
2. Manter a estação em operação com intervalo nominal de aproximadamente 60 segundos.
3. Registrar os relatórios EXP03a do Monitor Serial, identificando ciclo, uptime, data e versão experimental.
4. Coletar o tamanho do último JSON, tentativas, sucessos, falhas, bytes acumulados e taxa média.
5. Distinguir **resultados medidos** de projeções obtidas por multiplicação do volume médio.
6. Em testes posteriores, repetir a coleta sob condições controladas de indisponibilidade e recuperação, separando tráfego normal de *replay*.

Para comparações entre versões, deverão ser mantidos ou documentados: frequência de envio, conjunto de campos, período observado, conectividade, política de reenvio, versão do firmware e existência de dados externos válidos. O tamanho do JSON pode variar conforme campos opcionais e conteúdo dos valores.

## 6. Resultados observados

### 6.1 Medições da EXP03a

Em uma execução experimental registrada após **61 tentativas**, foram observados os seguintes valores:

| Indicador | Valor observado | Observação |
|---|---:|---|
| Tentativas HTTP | 61 | Janela experimental específica |
| Sucessos / falhas | 61 / 0 | Taxa observada de 100% nessa janela |
| Payload da última tentativa | 1.926 bytes | Tamanho de um registro, não média global |
| Payload tentado acumulado | 114,31 KiB | Conforme relatório serial da execução |
| Taxa média de payload tentado | 1.949,9 bytes/min | Calculada desde a primeira tentativa |

A média aritmética aproximada do payload tentado nessa janela é:

$$
\bar B \approx \frac{114{,}31\times1024}{61}\approx1.919\ \mathrm{bytes/tentativa}
$$

O resultado de aproximadamente **1,9 kB por leitura** é compatível com o último payload de 1.926 bytes, mas os dois valores não são idênticos e não devem ser tratados como se fossem a mesma medida.

Os números representam **uma execução observada**; não são intervalo de confiança nem caracterização estatística de longa duração.

### 6.2 Projeções de volume

Considerando exclusivamente o payload da aplicação e, como hipótese, **1.926 bytes por registro e um registro por minuto**, obtém-se:

| Horizonte | Registros nominais | Payload projetado | Equivalente binário aproximado |
|---|---:|---:|---:|
| 1 hora | 60 | 115.560 B | 112,9 KiB |
| 1 dia | 1.440 | 2.773.440 B | 2,64 MiB |
| 30 dias | 43.200 | 83.203.200 B | 79,35 MiB |
| 365 dias | 525.600 | 1.012.305.600 B | 965,41 MiB |
| 20 estações, 30 dias | 864.000 | 1.664.064.000 B | 1,55 GiB |

Essas são **projeções teóricas de payload**, não medições do tráfego efetivo, do armazenamento consumido no PostgreSQL, da cobrança do serviço ou do uso de dados de uma operadora. Elas não incluem retransmissões, cabeçalhos, TLS, consultas Open-Meteo, dashboard remoto, OTA ou alterações no tamanho dos registros.

Uma estimativa baseada na **taxa média observada de 1.949,9 bytes/min**, em vez do último payload, resultaria em aproximadamente **2,81 MB decimais por dia**. A pequena diferença ilustra a necessidade de explicitar a base utilizada em cada projeção.

### 6.3 Comunicação durante a resiliência

Nos testes posteriores da **EXP04b.2**, o firmware armazenou JSONs individuais no LittleFS durante a interrupção do Wi-Fi e realizou reenvio após a reconexão. Em um experimento de recuperação, o Supabase exibiu **18 registros com horários de medição consecutivos**, inseridos posteriormente em sequência, confirmando a preservação temporal daqueles registros.

Em um teste prolongado, o buffer atingiu aproximadamente **119 registros pendentes**, com **34 leituras não armazenadas** reportadas ao final; a fila posteriormente retornou a zero. Essas observações pertencem prioritariamente à **M4 — Resiliência** e não devem ser confundidas com o relatório de 61 POSTs da EXP03a.

O *replay* altera o padrão temporal da comunicação: em vez de um envio por minuto, podem ocorrer vários POSTs em intervalos menores enquanto a fila é drenada. A EXP03a original, isoladamente, **não caracteriza integralmente o tráfego do replay**, especialmente em versões com rotinas separadas para envio de registros pendentes.

## 7. Discussão e interpretação

### Processamento Edge não implica, automaticamente, economia de banda

O dispositivo calcula atributos derivados e envia um JSON enriquecido. Isso favorece a disponibilidade de informações interpretadas no Supabase, mas pode produzir **mais bytes** do que uma mensagem contendo apenas medições brutas. Portanto, não seria correto afirmar que a arquitetura já reduziu a banda em relação a um envio bruto, pois esse cenário alternativo ainda não foi instrumentado em condições equivalentes.

### Oportunidades de redução

Três estratégias futuras podem ser avaliadas separadamente:

- **Seleção de atributos:** enviar somente campos necessários à aplicação ou ao armazenamento histórico. A omissão de campos altera a informação preservada.
- **Codificação compacta:** reduzir a representação repetitiva de nomes de campos e valores; o ganho e a fidelidade precisam ser demonstrados para o esquema real de telemetria.
- **Envio orientado a eventos ou agregações:** transmitir resumos periódicos e eventos relevantes, preservando dados locais quando necessário. Essa estratégia muda a granularidade disponível na Cloud.

O objetivo da M3 não é escolher antecipadamente uma dessas soluções, mas estabelecer uma referência para medir seus benefícios e custos.

### Relação com o buffer de resiliência

Os cerca de 1,9 kB de JSON por leitura também influenciam a capacidade de armazenamento offline. Entretanto, o consumo real de LittleFS por arquivo foi superior ao tamanho lógico do JSON devido à organização do sistema de arquivos e aos mecanismos de reserva. Assim, **otimização de comunicação e otimização de armazenamento são relacionadas, mas não equivalentes**.

## 8. Limitações e ameaças à validade

1. **Escopo do payload:** a EXP03a mede o corpo JSON do POST, não os bytes efetivamente transmitidos pelo rádio Wi-Fi.
2. **Overhead de protocolos:** HTTP, TLS, TCP/IP, DNS, retransmissões e respostas estão fora dos contadores apresentados.
3. **Outros fluxos:** Open-Meteo, dashboard local, dashboard remoto e OTA não são contabilizados nessa métrica inicial.
4. **Amostra limitada:** os valores de 61 tentativas pertencem a uma execução específica, sem repetição estatística sistemática.
5. **Variabilidade do JSON:** campos opcionais, dados externos e valores podem alterar o tamanho da mensagem.
6. **Falhas anteriores ao POST:** erros em `http.begin()` não integram necessariamente as tentativas da EXP03a.
7. **Confirmação HTTP:** sucesso HTTP não prova, por si só, ausência de duplicidades ou consistência histórica completa.
8. **Ausência de cenário comparativo:** não foi executado experimento equivalente de envio somente de dados brutos ou de dados compactados.
9. **Reenvio posterior:** os contadores originais podem não incluir integralmente as rotinas de recuperação da EXP04b.2.
10. **Escalabilidade:** projeções para várias estações não incluem contenção de rede, limites de serviço, leituras remotas nem overhead de armazenamento em banco.

## 9. Próximos experimentos

| Experimento proposto | Objetivo | Evidência esperada |
|---|---|---|
| M3-A — Payload bruto vs. enriquecido | Comparar mensagens funcionalmente definidas | Bytes por registro e informação preservada |
| M3-B — Overhead de rede | Capturar tráfego real em ponto de observação adequado | Bytes transmitidos/recebidos por operação, incluindo protocolos |
| M3-C — Comunicação sob falha | Instrumentar tentativas, falhas e replay em uma mesma contabilidade | Tráfego normal, acumulado e de recuperação |
| M3-D — Codificação compacta | Avaliar tamanho, custo de CPU e fidelidade | Razão de compactação e tempo de codificação/decodificação |
| M3-E — Seleção e eventos | Avaliar política de envio seletivo | Redução de bytes, cobertura de eventos e perda informacional |
| M3-F — Rede multiestações | Avaliar escalabilidade com nós adicionais | Tráfego agregado, taxa de falhas e latência |

A instrumentação adicional deve preservar as métricas já implementadas e não comprometer o ciclo local de aquisição e processamento.

## 10. Conclusões parciais

A EXP03a estabeleceu uma **linha de base quantitativa do payload de telemetria**: em uma execução com 61 tentativas e 61 respostas de sucesso, o último JSON tinha 1.926 bytes, o acumulado tentado foi 114,31 KiB e a taxa média observada foi 1.949,9 bytes/min.

Esses resultados demonstram a ordem de grandeza do volume de aplicação produzido pela estação e permitem projeções explícitas para diferentes horizontes. **Não demonstram ainda economia de banda proporcionada pelo processamento Edge**, pois não houve comparação equivalente com outras estratégias e o overhead de rede não foi medido.

A próxima etapa da M3 será comparar alternativas de representação e transmissão, preservando a distinção entre volume de payload, tráfego efetivo, custo computacional e informação disponível para análise.

## 11. Referências e documentos relacionados

### Documentação interna

- [README — Avaliação experimental](README.md).
- [M1 — Latência](01-latencia.md).
- [M2 — Recursos computacionais](02-recursos-computacionais.md).
- [M4 — Resiliência](04-resiliencia.md) — ensaios realizados e critérios ainda pendentes de homologação.
- [Visão geral do projeto](../01-visao-geral.md).
- [Arquitetura da estação](../02-arquitetura.md).
- [Conectividade](../06-conectividade.md).
- [Integração Cloud](../07-cloud.md).
- [Processamento Edge](../09-processamento-edge.md) — conferir nome efetivo no repositório.

### Fontes técnicas e evidências

- Firmware experimental `EXP01b_EXP02a_EXP03a`, especialmente a serialização JSON e a rotina de POST ao Supabase.
- Saídas do Monitor Serial registradas durante a avaliação EXP03a.
- Documentação da biblioteca ArduinoJson: https://arduinojson.org/
- Documentação do cliente HTTP do Arduino-ESP32: https://docs.espressif.com/projects/arduino-esp32/en/latest/api/http.html
- Documentação Supabase REST API: https://supabase.com/docs/guides/api

> **Nota de rastreabilidade:** os resultados numéricos são transcritos das execuções experimentais discutidas no projeto. As projeções são cálculos derivados, identificados como tais. Recomenda-se arquivar, junto aos documentos de métricas, os logs brutos correspondentes e o identificador exato do commit do firmware utilizado.
