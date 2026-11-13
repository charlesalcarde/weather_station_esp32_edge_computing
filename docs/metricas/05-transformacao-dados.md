# M5 — Transformação e redução de dados no Edge

**Projeto:** Estação Ambiental Inteligente com ESP32  
**Local no repositório:** `docs/metricas/05-transformacao-dados.md`  
**Experimento:** EXP05 — M5-A (transformação), M5-B (redução) e M5-C (fidelidade)  
**Estado:** **avaliação experimental retrospectiva concluída**; transmissão seletiva **não implementada** no firmware  
**Data da consolidação:** 03/11/2026  
**Fonte experimental:** `public.leituras`, Supabase; estação `EA-0001`; campanha doméstica  
**Firmware auditado:** `EstacaoAmbiental_Etapa2_Integracao(1).ino`, função `enviarLeituraCloud()`  
**Recorte imutável por critério:** `estacao = 'EA-0001' AND epoch IS NOT NULL AND id <= 96330`

> **Síntese.** O firmware prevê 74 chaves JSON distintas, agrupadas em 3 medições ambientais básicas, 31 atributos derivados/analíticos, 11 campos de identificação/contexto e 29 campos de referência externa. Na amostra de 95.998 registros históricos, a política simulada **H15+Δ** selecionou **7.824 transmissões**, redução de **91,8498%** das requisições e **91,8410%** dos bytes JSON *estimados*. Os erros de reconstrução permaneceram, por construção da regra, dentro dos limiares exploratórios de 1 °C, 5 pontos percentuais e 1 hPa. Esses resultados **não** equivalem a economia real medida na rede ou no consumo energético.

---

## Índice

- [1. Introdução e escopo](#1-introdução-e-escopo)
- [2. Questões e desenho experimental](#2-questões-e-desenho-experimental)
- [3. Caracterização da campanha e da amostra](#3-caracterização-da-campanha-e-da-amostra)
- [4. M5-A — Inventário e transformação informacional](#4-m5-a--inventário-e-transformação-informacional)
- [5. M5-B — Políticas e redução de transmissões](#5-m5-b--políticas-e-redução-de-transmissões)
- [6. M5-C — Fidelidade da reconstrução](#6-m5-c--fidelidade-da-reconstrução)
- [7. Estimativa do volume de payload JSON](#7-estimativa-do-volume-de-payload-json)
- [8. Discussão integrada dos resultados](#8-discussão-integrada-dos-resultados)
- [9. Limitações e ameaças à validade](#9-limitações-e-ameaças-à-validade)
- [10. Reprodutibilidade e consultas SQL](#10-reprodutibilidade-e-consultas-sql)
- [11. Conclusões e trabalhos futuros](#11-conclusões-e-trabalhos-futuros)
- [12. Documentos relacionados](#12-documentos-relacionados)

---

## 1. Introdução e escopo

A Estação Ambiental ESP32 não se limita a transmitir medições instantâneas: ela produz estatísticas temporais, indicadores físicos, classificações e alertas na borda (*Edge*). A M5 investiga duas perguntas complementares:

1. **Quanto a borda transforma os dados básicos?**
2. **Quanto a Cloud deixaria de receber se o Edge transmitisse seletivamente, e qual seria a perda de fidelidade?**

A avaliação foi conduzida **retrospectivamente** sobre dados já persistidos no Supabase. Não foram alterados firmware, política real de envio, hardware ou registros históricos. A análise é uma **simulação contrafactual**: compara a telemetria integral observada com a seleção de leituras que *teria ocorrido* sob políticas hipotéticas.

**Ambiente:** a estação estava instalada em **ambiente doméstico**, relativamente protegido da atmosfera externa. Esse contexto pode reduzir ou alterar a variabilidade das séries. Os resultados não são automaticamente transferíveis a museus, laboratórios, ambientes fabris ou estações meteorológicas externas.

**Fora do escopo da EXP05 executada:** comparação controlada do custo incremental de CPU/heap de ligar e desligar algoritmos, medição de energia, tráfego total HTTP/TLS/Wi-Fi, implementação da transmissão seletiva e validação metrológica dos sensores. Custos de CPU e memória pertencem principalmente à M2 e não foram isolados neste experimento.

## 2. Questões e desenho experimental

| Dimensão | Pergunta | Evidência |
|---|---|---|
| **M5-A — Transformação** | Quais produtos informacionais são produzidos a partir das grandezas básicas? | Inspeção do firmware e presença de campos no histórico |
| **M5-B — Redução** | Quantas transmissões e quantos bytes JSON poderiam ser evitados? | Simulação de políticas sobre histórico fixado |
| **M5-C — Fidelidade** | Quanto a série reconstruída na Cloud se afastaria da série original? | MAE, erros máximos e episódios de desvio |

**Hipótese de trabalho:** alterações categóricas de estado ambiental são pouco frequentes em relação às leituras periódicas; a combinação de eventos, heartbeat e gatilhos numéricos pode reduzir a comunicação preservando limites explícitos de erro na reconstrução.

### 2.1 Políticas avaliadas

- **ORIGINAL:** todos os registros recebidos, incluindo uma duplicidade de `epoch`.
- **EVENTOS:** primeira leitura e mudança de pelo menos um dos campos `estado_geral`, `instabilidade`, `anomalia` ou `numero_alertas`.
- **H15, H30, H60:** eventos mais heartbeat de, respectivamente, 900, 1.800 e 3.600 segundos desde a **última transmissão simulada**.
- **H15+Δ:** H15 acrescida de gatilhos quando a diferença absoluta **em relação ao último valor transmitido** ultrapassa **1 °C** (temperatura), **5 pontos percentuais** (umidade) ou **1 hPa** (pressão local).

As mudanças categóricas são detectadas em relação à **leitura cronologicamente anterior**, mesmo que ela não tenha sido transmitida. Os limiares numéricos são **exploratórios**, não requisitos normativos de preservação ou segurança.

### 2.2 Reconstrução da Cloud

Para cada leitura original, o valor disponível hipoteticamente na Cloud é o **último valor transmitido** (*last observation carried forward*, LOCF). O erro é calculado **depois** de aplicar o gatilho de transmissão da leitura atual. Assim, uma leitura que dispara H15+Δ passa imediatamente a ser o novo valor de referência na simulação; não são modelados atrasos, perdas ou filas de rede.

## 3. Caracterização da campanha e da amostra

| Parâmetro | Valor |
|---|---|
| Estação | `EA-0001` |
| Ambiente | Doméstico |
| Período local | 26/08/2026 18:50:05 a 02/11/2026 22:45:06 (America/Sao_Paulo) |
| Registros originais | **95.998** |
| Instantes `epoch` distintos | **95.997** |
| Duplicidade identificada | Um `epoch` repetido, com dois IDs |
| Critério de seleção | `id <= 96330`, `epoch IS NOT NULL`, estação `EA-0001` |
| Ordenação nas simulações | `epoch`, depois `id` |
| Deduplicação | `DISTINCT ON (epoch)`, preservando menor `id` |

A duplicidade ocorreu no `epoch = 1793086491` (27/10/2026, 04:34:51, horário local), IDs `87430` e `87431`. A causa não foi demonstrada; não se deve atribuí-la automaticamente a replay. A base **ORIGINAL** contabiliza 95.998 registros; as políticas simuladas operam sobre **95.997 instantes distintos**.

A restrição por ID torna a amostra estável contra novas inserções, mas **não garante imutabilidade** caso registros antigos sejam editados. Para reprodução integral, preservar um *snapshot* ou exportação versionada do recorte.

## 4. M5-A — Inventário e transformação informacional

### 4.1 Fontes físicas e origem dos dados

- **BMP180:** temperatura canônica da telemetria e pressão atmosférica.
- **DHT11:** umidade relativa; a temperatura auxiliar do DHT11 não é enviada como `temperatura` nesse payload.
- **Histórico local, relógio e configuração:** suporte a médias, extremos, tendências e correções.
- **Open-Meteo:** referência meteorológica externa consultada pelo ESP32; **não** é medição local nem atributo derivado dos sensores físicos.

### 4.2 Inventário auditado da função de envio

A inspeção das atribuições `doc["chave"] = ...` em `enviarLeituraCloud()` identificou **74 chaves JSON distintas possíveis**:

| Grupo | Quantidade | Interpretação |
|---|---:|---|
| Grandezas ambientais básicas | **3** | `temperatura`, `umidade`, `pressao_local` |
| Atributos derivados e analíticos | **31** | Estatísticas, indicadores, estados e alertas |
| Identificação, tempo e contexto operacional | **11** | Identificação, horários, amostras, RSSI, altitude e origem |
| Referência meteorológica externa | **29** | Metadados e condições Open-Meteo |
| **Total** | **74** | Campos **possíveis**, não necessariamente presentes em cada JSON |

Os 31 atributos derivados/analíticos são:

| Família | Quantidade | Campos |
|---|---:|---|
| Temperatura | 5 | `temperatura_media15`, `temperatura_min_dia`, `hora_temperatura_min`, `temperatura_max_dia`, `hora_temperatura_max` |
| Umidade | 5 | `umidade_media15`, `umidade_min_dia`, `hora_umidade_min`, `umidade_max_dia`, `hora_umidade_max` |
| Pressão | 9 | `pressao_mar`, `pressao_media15`, `pressao_media60`, `pressao_min_dia`, `hora_pressao_min`, `pressao_max_dia`, `hora_pressao_max`, `variacao_pressao_janela`, `tendencia_pressao_hora` |
| Termodinâmica | 1 | `ponto_orvalho` |
| Estados e classificações | 6 | `estado_geral`, `estado_umidade`, `estado_conforto`, `estado_pressao`, `instabilidade`, `anomalia` |
| Alertas | 5 | `numero_alertas`, `alerta1`, `alerta2`, `alerta3`, `alerta4` |
| **Total** | **31** | |

**Atenção à semântica:** horários de extremos, rótulos e mensagens são **produtos informacionais**, mas não 31 novas grandezas físicas ou informações independentes. A relação estrutural `31 / 3 ≈ 10,33` é apenas uma razão descritiva de atributos analíticos por grandeza básica; **não mede ganho de informação, precisão ou entropia**.

A referência antiga do quadro de planejamento, **“4 valores → ~60 atributos”**, foi substituída pelo inventário verificado **“3 grandezas locais → 31 atributos derivados/analíticos; 74 chaves possíveis no JSON completo”**.

### 4.3 Presença dos atributos no histórico

Uma consulta de presença sobre os **31 campos** retornou:

| Indicador | Resultado |
|---|---:|
| Registros avaliados | 95.998 |
| Mínimo de campos não nulos por registro | 31 |
| Média | 31,00 |
| Máximo | 31 |
| Registros com os 31 campos não nulos | 95.998 |

Isso demonstra **completude de não nulidade dos campos selecionados** no recorte. **Não** demonstra independência, qualidade metrológica, pertinência de cada alerta ou ausência de strings vazias. A contagem do inventário e a contagem SQL são ambas de **31 campos**; a divergência mencionada durante a discussão foi um erro de contagem posteriormente corrigido.

### 4.4 Condicionalidade do payload

O firmware inclui `ultima_leitura`, `externo_atualizado` e `externo_ultima_tentativa` apenas quando os respectivos horários são válidos. Os **18 campos externos detalhados** são incluídos quando `externoJaRecebeuDados` é verdadeiro. O banco adiciona `id` e `created_at`, que **não** fazem parte do JSON enviado.

O firmware serializa o documento com `serializeJson(doc, payload)` e envia o corpo por HTTPS. A instrumentação EXP03a contém `payload.length()`, que mede o tamanho do JSON serializado no dispositivo; não foram recuperadas medições pareadas dessa instrumentação para validar byte a byte o recorte histórico.

## 5. M5-B — Políticas e redução de transmissões

### 5.1 Resultados das políticas

| Política | Transmissões simuladas | % da base original | Redução de requisições |
|---|---:|---:|---:|
| ORIGINAL | 95.998 | 100,00% | — |
| EVENTOS | 1.964 | 2,05% | **97,95%** |
| H15 | 7.782 | 8,11% | **91,8936%** |
| H30 | 4.610 | 4,80% | **95,20%** |
| H60 | 3.107 | 3,24% | **96,76%** |
| **H15+Δ** | **7.824** | **8,15%** | **91,8498%** |

Os percentuais de H15 e H15+Δ foram preservados com quatro casas decimais conforme as consultas; os demais estão arredondados a duas casas. A diferença de uma leitura entre a base original e a série deduplicada tem efeito desprezível sobre os percentuais, mas é metodologicamente documentada.

### 5.2 Fórmulas

Para uma política `p`, usando a base original como referência:

$$
R_{\mathrm{req},p} = 100\left(1-\frac{N_{\mathrm{tx},p}}{N_{\mathrm{original}}}\right)
$$

Onde `N_original = 95.998` e `N_tx,p` é a quantidade de transmissões simuladas.

Para a H15+Δ:

$$
N_{\mathrm{evitadas}} = 95\,998 - 7\,824 = 88\,174
$$

$$
R_{\mathrm{req,H15+\Delta}} =
100\left(1-\frac{7\,824}{95\,998}\right)
\approx 91{,}8498\%
$$

Esses valores são **reduções simuladas na contagem de requisições**, não medições de economia de rede ou energia.

## 6. M5-C — Fidelidade da reconstrução

### 6.1 Métricas

Seja `x_i` o valor original de uma variável na leitura `i`, e `\hat{x}_i` o último valor que teria chegado à Cloud segundo a política simulada:

$$
e_i = \left|x_i-\hat{x}_i\right|
$$

$$
\mathrm{MAE} = \frac{1}{n}\sum_{i=1}^{n} e_i
$$

$$
e_{\max} = \max_{1\leq i\leq n} e_i
$$

A avaliação considera `n = 95.997` instantes deduplicados. Temperatura em **°C**, umidade em **pontos percentuais (pp)** e pressão local em **hPa**.

### 6.2 Resultados de reconstrução

| Política | MAE T (°C) | MAE UR (pp) | MAE P (hPa) | Máx. T (°C) | Máx. UR (pp) | Máx. P (hPa) |
|---|---:|---:|---:|---:|---:|---:|
| EVENTOS | 0,2333 | 1,6843 | 0,9374 | 3,50 | 20,00 | 8,29 |
| H15 | 0,0478 | 0,2496 | 0,0958 | 3,00 | 13,00 | 2,52 |
| H30 | 0,0669 | 0,3805 | 0,1512 | 3,00 | 13,00 | 4,57 |
| H60 | 0,0936 | 0,5829 | 0,2358 | 2,90 | 13,00 | 4,57 |
| **H15+Δ** | **0,0467** | **0,2477** | **0,0933** | **1,00** | **5,00** | **1,00** |

A política EVENTOS, embora econômica em transmissões, apresenta erros maiores e não deve ser tratada como equivalente à H15+Δ em fidelidade.

### 6.3 Erros extremos da H15

Foram adotados **limites exploratórios estritos**: erro de temperatura `> 1 °C`, umidade `> 5 pp` ou pressão `> 1 hPa`.

| Indicador | Resultado H15 |
|---|---:|
| Leituras com erro de temperatura acima do limite | 97 |
| Leituras com erro de umidade acima do limite | 41 |
| Leituras com erro de pressão acima do limite | 186 |
| Leituras com pelo menos um erro acima do limite | **300** |
| Percentual de instantes com erro extremo | **0,3125%** |
| Maior sequência consecutiva | **12 leituras** |
| Maior intervalo entre primeira e última leitura extrema da sequência | **660 s (11 min)** |

A soma `97 + 41 + 186 = 324` supera 300 porque alguns instantes ultrapassaram mais de um limite. O intervalo de 660 segundos é **duração observada entre amostras**, não duração contínua exata do fenômeno.

Na consulta dos 30 episódios mais longos, predominaram episódios com `estado_geral = ESTAVEL`. Exemplos:

| Início local | Leituras | Intervalo observado | Máximo relevante | Estado |
|---|---:|---:|---|---|
| 30/09/2026 17:58:51 | 12 | 11 min | UR 8 pp; T 1,5 °C | ESTAVEL |
| 23/10/2026 09:57:24 | 12 | 11 min | UR 13 pp | ESTAVEL |
| 25/10/2026 23:12:50 | 12 | 11 min | T 1,7 °C | ESTAVEL |
| 11/10/2026 17:28:01 | 11 | 10 min | T 1,8 °C; P 1,47 hPa | ESTAVEL |

**Interpretação:** a classificação `ESTAVEL` não implica que o valor numérico seja constante. Isso **não prova erro do classificador ambiental**: classificação de estado e fidelidade de reconstrução respondem a objetivos diferentes.

### 6.4 Ganho da política H15+Δ

| Indicador | H15 | H15+Δ | Diferença |
|---|---:|---:|---:|
| Transmissões | 7.782 | 7.824 | **+42** |
| Erros acima dos limites exploratórios | 300 | 0 | −300 |
| Máximo T | 3,00 °C | 1,00 °C | −2,00 °C |
| Máximo UR | 13 pp | 5 pp | −8 pp |
| Máximo P | 2,52 hPa | 1,00 hPa | −1,52 hPa |

O acréscimo foi de aproximadamente **0,54% das transmissões da H15**. A eliminação dos erros acima dos limiares é **consequência lógica da regra simulada**: a leitura que ultrapassaria o limite é transmitida antes da avaliação do erro reconstruído. **Não** constitui validação independente de precisão, detecção de riscos ou desempenho em rede real.

## 7. Estimativa do volume de payload JSON

### 7.1 Método e unidade

O SQL da Etapa 12 estimou, para cada linha:

```sql
octet_length(
  jsonb_strip_nulls(to_jsonb(l) - 'id' - 'created_at')::text
)
```

Os bytes foram somados para a base ORIGINAL e para as linhas selecionadas por H15 e H15+Δ. A medida é a **representação JSON do PostgreSQL**, e **não** o resultado byte a byte de `serializeJson()` no ESP32. Não inclui HTTP, TLS, Wi-Fi, retransmissões ou outros overheads. O cálculo inclui todos os campos persistidos não nulos, exceto `id` e `created_at`; portanto, é um **proxy do payload**, sujeito a diferenças de estrutura, formato e versão de firmware.

$$
B_{\mathrm{total},p} = \sum_{i \in S_p} B_i
$$

$$
R_{\mathrm{bytes},p} =
100\left(1-\frac{B_{\mathrm{total},p}}{B_{\mathrm{total,original}}}\right)
$$

$$
\mathrm{MiB} = \frac{\mathrm{bytes}}{1\,048\,576}
$$

### 7.2 Resultados

| Política | Transmissões | Bytes JSON estimados | MiB | Média bytes/envio | Redução bytes |
|---|---:|---:|---:|---:|---:|
| ORIGINAL | 95.998 | 198.641.730 | 189,4395 | 2.069,23 | — |
| H15 | 7.782 | 16.120.123 | 15,3733 | 2.071,46 | **91,8848%** |
| **H15+Δ** | **7.824** | **16.207.199** | **15,4564** | **2.071,47** | **91,8410%** |

A H15+Δ representaria **182.434.531 bytes** de JSON estimados a menos que a base original, equivalentes a aproximadamente **173,98 MiB**. Em relação à H15, ela acrescentaria **87.076 bytes** (aproximadamente **85,04 KiB**) para 42 transmissões extras.

A redução percentual de bytes é próxima à redução de requisições porque os tamanhos médios dos JSONs selecionados e originais são semelhantes. Isso **não implica** a mesma redução percentual do tráfego de rede completo.

### 7.3 Validação estrutural adicional — Etapa 13

A condição de inclusão dos 18 campos externos detalhados foi testada no SQL:

| Indicador | Resultado |
|---|---:|
| Registros com `externo_tem_dados = true` | 95.997 |
| Registros sem dados externos detalhados | 1 |
| Bytes antes do ajuste | 198.641.730 |
| Bytes após o ajuste | 198.641.730 |
| Diferença | **0** |
| Menor JSON estimado | 1.569 bytes |
| Maior JSON estimado | 2.171 bytes |

**Conclusão limitada:** a remoção condicional dos campos externos detalhados não alterou a estimativa nesse histórico. Isso **não valida** equivalência exata entre ArduinoJson e PostgreSQL, nem cobre todas as condições de omissão de campos.

## 8. Discussão integrada dos resultados

A M5 evidencia duas capacidades distintas da arquitetura:

1. **Transformação no Edge:** as três grandezas ambientais locais sustentam estatísticas, tendências, estados e alertas, permitindo interpretação local sem depender continuamente da Cloud.
2. **Seleção de comunicação:** a simulação retrospectiva mostra que é possível evitar muitas transmissões periódicas, preservando os valores reconstruídos dentro de limites numéricos explícitos na amostra analisada.

O contraste entre H15 e H15+Δ é central: **42 transmissões adicionais** reduziram substancialmente os erros máximos, preservando **91,85%** de redução simulada de requisições. A diferença entre estados categóricos e variações numéricas explica a utilidade do gatilho adicional.

**Escolha experimental:** H15+Δ é a política mais favorável **entre as duas variantes de heartbeat de 15 minutos testadas**, para os limiares escolhidos e o histórico doméstico. Não foi feita otimização global dos limiares, avaliação independente em outras campanhas ou demonstração de segurança operacional.

## 9. Limitações e ameaças à validade

1. **Dependência ambiental:** a campanha é doméstica; museus, laboratórios, indústrias e ambiente externo podem exigir outros limiares e apresentar maior variabilidade.
2. **Simulação retrospectiva:** não houve transmissão seletiva real; a redução de requisições é contrafactual.
3. **Fidelidade condicionada à regra:** zero ultrapassagens na H15+Δ decorre dos gatilhos e da avaliação imediata após o envio simulado.
4. **Sem rede real na simulação:** não há latência, perda, falha de POST, atraso, fila, custo de handshake ou retransmissão.
5. **Reconstrução LOCF:** o erro é calculado nos instantes amostrados, não continuamente entre leituras.
6. **Eventos categóricos:** mudança de estado é comparada à leitura anterior; a política não foi validada para outros mecanismos de eventos.
7. **JSON aproximado:** PostgreSQL e ArduinoJson podem divergir na precisão decimal, formato de horário, campos nulos e representação de valores.
8. **Possíveis versões de firmware:** o histórico cobre várias semanas; o código auditado pode não reproduzir exatamente todas as versões que geraram os registros.
9. **Contagem de atributos:** 31 inclui horários, rótulos e mensagens; não são 31 informações independentes. Não nulidade não garante utilidade.
10. **Duplicidade:** um `epoch` duplicado foi deduplicado nas simulações, mas mantido no baseline; a causa não foi demonstrada.
11. **Limiares exploratórios:** 1 °C, 5 pp e 1 hPa não são critérios universais de conservação, segurança ou precisão metrológica.
12. **Sem análise de energia/CPU incremental:** ganhos de banda estimados não demonstram ganhos equivalentes em consumo energético ou processamento.
13. **Sem validação externa de anomalias:** o rótulo `ESTAVEL` não foi usado como verdade de referência sobre ausência de fenômenos ambientais.

## 10. Reprodutibilidade e consultas SQL

### 10.1 Critérios gerais

As consultas foram executadas no SQL Editor do Supabase, usando `SELECT` e, nas simulações, funções temporárias `pg_temp`. Não houve `UPDATE`, `DELETE`, `INSERT` ou alteração permanente do firmware ou dos dados.

```sql
-- Amostra de referência: 95.998 registros
SELECT COUNT(*) AS registros,
       COUNT(DISTINCT epoch) AS instantes
FROM public.leituras
WHERE estacao = 'EA-0001'
  AND epoch IS NOT NULL
  AND id <= 96330;
```

```sql
-- Série temporal deduplicada para as simulações: 95.997 leituras
SELECT DISTINCT ON (epoch)
       id, epoch, temperatura, umidade, pressao_local,
       estado_geral, instabilidade, anomalia, numero_alertas
FROM public.leituras
WHERE estacao = 'EA-0001'
  AND epoch IS NOT NULL
  AND id <= 96330
ORDER BY epoch, id;
```

### 10.2 Algoritmo reproduzível de seleção

O pseudocódigo abaixo formaliza a lógica utilizada nas funções temporárias SQL; **não é firmware executável**.

```text
para politica em [EVENTOS, H15, H30, H60, H15+DELTA]:
    ultimo_envio = nenhum
    leitura_anterior = nenhuma

    para leitura em serie_deduplicada_ordenada:
        evento = primeira_leitura OU
                 mudou(estado_geral, instabilidade,
                       anomalia, numero_alertas)
                 comparado_com(leitura_anterior)

        heartbeat = ultimo_envio existe E
                    (leitura.epoch - ultimo_envio.epoch >= intervalo_politica)

        delta = ultimo_envio existe E (
                  abs(leitura.temperatura - ultimo_envio.temperatura) > 1.0
               OU abs(leitura.umidade - ultimo_envio.umidade) > 5.0
               OU abs(leitura.pressao_local - ultimo_envio.pressao_local) > 1.0
        )

        transmitir = evento
                  OU (politica_tem_heartbeat E heartbeat)
                  OU (politica == H15+DELTA E delta)

        se transmitir:
            ultimo_envio = leitura
            contar_transmissao()
            somar_bytes_json_estimados(leitura)

        reconstruido = ultimo_envio
        acumular_erros_absolutos(leitura, reconstruido)
        leitura_anterior = leitura
```

O heartbeat não cria leituras artificiais em intervalos sem dados; só pode transmitir quando existe uma leitura disponível. A política EVENTOS não usa heartbeat; H15+Δ usa 900 s.

### 10.3 Verificação do inventário

A contagem de **74 chaves possíveis** foi obtida inspecionando as atribuições `doc["..."]` da função `enviarLeituraCloud()`. A validação dos **31 campos derivados** foi realizada com `jsonb_build_object(...)` e `jsonb_each(...)`, contando valores distintos de JSON `null` por registro. Os resultados foram 31/31 não nulos em todos os 95.998 registros.

Para auditar os bytes do proxy:

```sql
SELECT COUNT(*) AS registros,
       SUM(
         octet_length(
           jsonb_strip_nulls(
             to_jsonb(l) - 'id' - 'created_at'
           )::text
         )
       ) AS bytes_estimados
FROM public.leituras AS l
WHERE l.estacao = 'EA-0001'
  AND l.epoch IS NOT NULL
  AND l.id <= 96330;
```

**Rastreabilidade:** os resultados detalhados das etapas de simulação (EVENTOS/H15/H30/H60, episódios extremos, H15+Δ, bytes e condição externa) foram obtidos nas execuções SQL da campanha e consolidados neste documento. Para reprodução exata, recomenda-se versionar também os scripts completos e um *snapshot* do recorte; o pseudocódigo e as consultas resumidas acima não substituem esses artefatos.

## 11. Conclusões e trabalhos futuros

A EXP05 está **concluída no escopo definido**:

- **M5-A:** inventário do firmware com **74 campos possíveis**, incluindo **31 atributos derivados/analíticos**; presença não nula dos 31 no histórico avaliado.
- **M5-B:** política H15+Δ com **7.824 transmissões simuladas** contra **95.998 registros originais**, redução de **91,8498%** das requisições e **91,8410%** dos bytes JSON estimados.
- **M5-C:** MAEs de **0,0467 °C**, **0,2477 pp** e **0,0933 hPa**; erros máximos de **1 °C**, **5 pp** e **1 hPa**, sob os limiares experimentais.

A conclusão científica é de **potencial de redução de comunicação com fidelidade de reconstrução controlada**, **não** de economia operacional já implantada.

**Trabalhos futuros, fora da EXP05 atual:**

1. Avaliar campanhas em ambientes com perfis distintos, mantendo identificação de localização física, referência externa e campanha separadas.
2. Recalcular dinamicamente a M5 no dashboard Vercel, distinguindo resultados simulados de medições operacionais.
3. Se a transmissão seletiva for implementada, manter uma referência completa de auditoria (por exemplo, histórico local) para não perder a capacidade de avaliar o erro de reconstrução.
4. Validar o tamanho do JSON contra amostras reais de `payload.length()` do firmware e, separadamente, medir tráfego total e consumo energético.
5. Explorar sensibilidade a limiares, períodos de heartbeat e atrasos de rede; não extrapolar os resultados domésticos para aplicações críticas sem novos ensaios.

**Apresentação atual:** relatório acadêmico como registro primário; uma página estática no dashboard pode exibir resultados identificados por campanha. O monitoramento dinâmico da M5 é evolução posterior, não parte desta validação.

## 12. Documentos relacionados

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
- [Processamento Edge](../09-processamento-edge.md).
- [Particionamento da Flash](../08-particionamento-flash.md).

**Fontes primárias:** firmware auditado `EstacaoAmbiental_Etapa2_Integracao(1).ino`; tabela histórica `public.leituras` (recorte definido na seção 3); resultados SQL das etapas EXP05 executadas. Não foram atribuídas referências bibliográficas externas não verificadas.
