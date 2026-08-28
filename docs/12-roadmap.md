# Roadmap da Estação Ambiental ESP32

Este documento registra a evolução planejada da **Estação Ambiental
ESP32**, distinguindo funcionalidades já consolidadas, recursos em
desenvolvimento e possibilidades futuras de pesquisa.

> O roadmap deve ser atualizado conforme novas versões forem
> homologadas. Itens futuros representam planejamento técnico e não
> funcionalidades já disponíveis.

------------------------------------------------------------------------

## Índice

-   [1. Visão geral](#1-visão-geral)
-   [2. Princípios de evolução](#2-princípios-de-evolução)
-   [3. Estado atual do projeto](#3-estado-atual-do-projeto)
-   [4. Arquitetura atual](#4-arquitetura-atual)
-   [5. Fase 1 --- Fundação
    experimental](#5-fase-1--fundação-experimental)
-   [6. Fase 2 --- Processamento Edge](#6-fase-2--processamento-edge)
-   [7. Fase 3 --- Dashboard local](#7-fase-3--dashboard-local)
-   [8. Fase 4 --- Conectividade e
    configuração](#8-fase-4--conectividade-e-configuração)
-   [9. Fase 5 --- Integração Cloud](#9-fase-5--integração-cloud)
-   [10. Fase 6 --- Consolidação da
    v3.4](#10-fase-6--consolidação-da-v34)
-   [11. Dashboard Web remoto](#11-dashboard-web-remoto)
-   [12. Histórico de longo prazo](#12-histórico-de-longo-prazo)
-   [13. Eventos na Cloud](#13-eventos-na-cloud)
-   [14. Resiliência Edge--Cloud](#14-resiliência-edgecloud)
-   [15. Fila local de telemetria](#15-fila-local-de-telemetria)
-   [16. Estratégia de reenvio](#16-estratégia-de-reenvio)
-   [17. Prevenção de duplicidades](#17-prevenção-de-duplicidades)
-   [18. OTA](#18-ota)
-   [19. Modularização do firmware](#19-modularização-do-firmware)
-   [20. Monitoramento de recursos](#20-monitoramento-de-recursos)
-   [21. TinyML](#21-tinyml)
-   [22. Detecção inteligente de
    anomalias](#22-detecção-inteligente-de-anomalias)
-   [23. Integração com assistentes e
    LLMs](#23-integração-com-assistentes-e-llms)
-   [24. Múltiplas estações](#24-múltiplas-estações)
-   [25. Eficiência energética](#25-eficiência-energética)
-   [26. Segurança](#26-segurança)
-   [27. Observabilidade](#27-observabilidade)
-   [28. Possibilidades acadêmicas](#28-possibilidades-acadêmicas)
-   [29. Critérios para novas
    funcionalidades](#29-critérios-para-novas-funcionalidades)
-   [30. Visão de longo prazo](#30-visão-de-longo-prazo)
-   [31. Resumo](#31-resumo)

------------------------------------------------------------------------

## 1. Visão geral

A Estação Ambiental ESP32 evoluiu de um experimento de leitura de
sensores para uma plataforma distribuída de Computação de Borda.

A trajetória pode ser resumida por:

``` text
sensores
   │
   ▼
aquisição
   │
   ▼
processamento Edge
   │
   ▼
dashboard local
   │
   ▼
conectividade
   │
   ▼
Cloud
   │
   ▼
histórico e serviços
   │
   ▼
inteligência futura
```

O roadmap procura preservar essa evolução incremental.

------------------------------------------------------------------------

## 2. Princípios de evolução

Novas funcionalidades devem respeitar alguns princípios:

-   processamento local permanece prioritário;
-   falhas externas não devem interromper funções essenciais;
-   cada etapa deve ser validada antes da seguinte;
-   recursos de memória devem ser monitorados;
-   segurança deve fazer parte da arquitetura;
-   funcionalidades experimentais devem ser identificadas como tais;
-   documentação e código devem evoluir juntos.

A arquitetura deve continuar seguindo:

``` text
Edge primeiro
Cloud como extensão
```

------------------------------------------------------------------------

## 3. Estado atual do projeto

Na fase atual, a plataforma já possui:

-   ESP32 como nó Edge;
-   BMP180;
-   DHT11;
-   aquisição periódica;
-   processamento temporal;
-   médias móveis;
-   mínimos e máximos;
-   pressão corrigida;
-   ponto de orvalho;
-   tendência barométrica;
-   estados ambientais;
-   histerese;
-   eventos;
-   alertas;
-   dashboard local;
-   LittleFS;
-   múltiplas redes Wi-Fi;
-   portal de configuração;
-   NVS;
-   mDNS;
-   Open-Meteo;
-   telemetria Supabase;
-   particionamento personalizado;
-   estrutura de Flash preparada para OTA.

Esse conjunto constitui a base para as próximas etapas.

------------------------------------------------------------------------

## 4. Arquitetura atual

``` text
                    ┌───────────────────┐
                    │    Open-Meteo     │
                    └─────────┬─────────┘
                              │
                              ▼
┌─────────┐             ┌─────────────┐
│ BMP180  │────────────►│             │
└─────────┘             │    ESP32    │
                        │             │
┌─────────┐             │    EDGE     │
│ DHT11   │────────────►│             │
└─────────┘             └──────┬──────┘
                               │
                 ┌─────────────┼─────────────┐
                 │             │             │
                 ▼             ▼             ▼
             LittleFS     Dashboard       Supabase
                              local           │
                                              ▼
                                          PostgreSQL
```

A evolução futura deve ampliar essa arquitetura sem transformar a Cloud
em requisito para a operação local.

------------------------------------------------------------------------

## 5. Fase 1 --- Fundação experimental

### Situação: concluída

Objetivos alcançados:

-   domínio básico da plataforma ESP32;
-   GPIO e LED;
-   Serial Monitor;
-   conexão Wi-Fi;
-   acesso HTTP;
-   consumo de APIs;
-   servidor Web local;
-   integração inicial dos sensores.

Essa fase estabeleceu a infraestrutura experimental do projeto.

------------------------------------------------------------------------

## 6. Fase 2 --- Processamento Edge

### Situação: concluída e em evolução

Foram incorporados:

-   agregação temporal;
-   média de 15 minutos;
-   histórico de 60 minutos;
-   mínimos e máximos;
-   pressão ao nível do mar;
-   ponto de orvalho;
-   regressão de pressão;
-   classificação;
-   histerese;
-   eventos;
-   alertas.

O projeto deixou de ser apenas um sistema de aquisição e passou a
produzir informação localmente.

------------------------------------------------------------------------

## 7. Fase 3 --- Dashboard local

### Situação: concluída e evolutiva

O dashboard local já oferece:

-   visualização de sensores;
-   indicadores derivados;
-   gráficos;
-   eventos;
-   configurações;
-   dados externos;
-   modo claro/escuro;
-   favicon;
-   atualização local.

Os arquivos Web são armazenados em LittleFS.

------------------------------------------------------------------------

## 8. Fase 4 --- Conectividade e configuração

### Situação: concluída e evolutiva

Foram implementados:

-   múltiplas redes Wi-Fi;
-   seleção automática;
-   fallback para Access Point;
-   portal de configuração;
-   persistência em NVS;
-   hostname configurável;
-   mDNS;
-   localização;
-   altitude.

A estação tornou-se mais independente de configurações fixas no
código-fonte.

------------------------------------------------------------------------

## 9. Fase 5 --- Integração Cloud

### Situação: PoC validada

A telemetria para Supabase demonstrou:

``` text
ESP32
  │
  ▼
HTTPS / REST
  │
  ▼
Supabase
  │
  ▼
PostgreSQL
```

A Cloud recebe snapshots periódicos sem assumir o processamento
ambiental primário.

------------------------------------------------------------------------

## 10. Fase 6 --- Consolidação da v3.4

### Situação: em consolidação

Objetivos principais:

-   estabilizar o schema definitivo;
-   manter temperatura BMP180 como referência Cloud;
-   transmitir indicadores derivados;
-   preservar compatibilidade durante migração;
-   validar telemetria completa;
-   consolidar documentação;
-   preparar a etapa Web remota.

Após homologação, campos legados do banco poderão ser avaliados para
remoção.

------------------------------------------------------------------------

## 11. Dashboard Web remoto

### Situação: planejado

A arquitetura prevista é:

``` text
ESP32
  │
  ▼
Supabase
  │
  ▼
Frontend Web
  │
  ▼
usuário remoto
```

O dashboard remoto deverá:

-   reproduzir indicadores essenciais;
-   mostrar histórico;
-   permitir seleção de período;
-   funcionar fora da rede local;
-   utilizar HTTPS;
-   futuramente utilizar autenticação.

O dashboard local continuará existindo para diagnóstico, configuração e
operação independente.

------------------------------------------------------------------------

## 12. Histórico de longo prazo

A Cloud permitirá ampliar a escala temporal:

``` text
ESP32
└── aproximadamente 60 minutos

Cloud
├── dias
├── meses
└── anos
```

Com uma amostra por minuto:

$$
N_{\mathrm{dia}}=1440
$$

e:

$$
N_{\mathrm{ano}}=1440\times365=525600
$$

Para $E$ estações:

$$
N_{\mathrm{total}}=E\times525600
$$

Esses valores deverão orientar retenção, índices e futuras agregações.

------------------------------------------------------------------------

## 13. Eventos na Cloud

### Situação: planejado

Além de snapshots periódicos, eventos poderão ser enviados para:

``` text
public.eventos
```

Exemplos:

-   mudança de estado;
-   alerta;
-   perda de conectividade;
-   recuperação;
-   reboot;
-   anomalia.

Isso permitirá correlacionar séries temporais com acontecimentos
discretos.

------------------------------------------------------------------------

## 14. Resiliência Edge--Cloud

### Situação: planejado

A indisponibilidade da Cloud não deve provocar perda imediata das
leituras destinadas à telemetria.

Fluxo futuro:

``` text
snapshot
   │
   ▼
enviar
   │
 ┌─┴─┐
sim  não
 │    │
 ▼    ▼
fim  fila local
        │
        ▼
     reenviar
```

A fila deve ser limitada para proteger a memória do dispositivo.

------------------------------------------------------------------------

## 15. Fila local de telemetria

Se a capacidade máxima for $Q_{\mathrm{max}}$:

$$
0\le Q\le Q_{\mathrm{max}}
$$

Se $A$ snapshots forem adicionados e $R$ forem removidos após envio
bem-sucedido:

$$
Q_{\mathrm{novo}}=\min(Q_{\mathrm{max}},Q_{\mathrm{anterior}}+A-R)
$$

A implementação deverá garantir também:

$$
Q_{\mathrm{novo}}\ge0
$$

Será necessário definir uma política para o caso de fila cheia.

Possibilidades incluem:

-   descartar o registro mais antigo;
-   preservar eventos prioritários;
-   persistir parte da fila em Flash;
-   reduzir temporariamente a frequência de armazenamento.

------------------------------------------------------------------------

## 16. Estratégia de reenvio

### Situação: planejado

O reenvio não deve bloquear o loop principal.

Uma estratégia de backoff exponencial pode utilizar:

$$
T_n=\min(T_{\mathrm{max}},T_0\times2^n)
$$

onde:

-   $n$ = número de falhas consecutivas;
-   $T_0$ = intervalo inicial;
-   $T_{\mathrm{max}}$ = intervalo máximo.

Esse mecanismo evita requisições excessivas durante indisponibilidade
prolongada.

------------------------------------------------------------------------

## 17. Prevenção de duplicidades

### Situação: planejado

Cada snapshot poderá possuir um identificador único:

``` text
UUID
```

O backend poderá impedir duplicidade utilizando uma restrição de
unicidade.

Conceitualmente:

``` text
estacao + UUID
        │
        ▼
registro único
```

Isso será especialmente importante quando houver reenvio de dados
armazenados localmente.

------------------------------------------------------------------------

## 18. OTA

### Situação: infraestrutura de Flash preparada; mecanismo ainda não implementado

O particionamento já possui:

``` text
otadata
app0
app1
```

Fluxo futuro:

``` text
APP ativa
   │
   ▼
baixar atualização
   │
   ▼
gravar APP inativa
   │
   ▼
verificar
   │
   ▼
reiniciar
   │
   ▼
nova APP
```

Uma implementação segura deverá considerar:

-   integridade;
-   autenticidade da imagem;
-   rollback;
-   falha de energia;
-   compatibilidade de filesystem;
-   versão de schema/configuração.

------------------------------------------------------------------------

## 19. Modularização do firmware

### Situação: evolução recomendada

À medida que o firmware cresce, funcionalidades poderão ser separadas em
módulos C++.

Exemplo:

``` text
src/
├── sensores.cpp
├── processamento.cpp
├── wifi.cpp
├── cloud.cpp
├── webserver.cpp
├── eventos.cpp
└── configuracao.cpp
```

com headers correspondentes.

A modularização deverá buscar:

-   menor acoplamento;
-   maior testabilidade;
-   manutenção mais simples;
-   separação de responsabilidades.

------------------------------------------------------------------------

## 20. Monitoramento de recursos

O crescimento do firmware deve continuar sendo acompanhado.

Para tamanho binário $S_{\mathrm{bin}}$ e capacidade APP
$S_{\mathrm{APP}}$:

$$
U_{\mathrm{APP}}=\frac{S_{\mathrm{bin}}}{S_{\mathrm{APP}}}\times100
$$

A margem é:

$$
M_{\mathrm{APP}}=S_{\mathrm{APP}}-S_{\mathrm{bin}}
$$

Para LittleFS:

$$
U_{\mathrm{FS}}=\frac{S_{\mathrm{arquivos}}}{S_{\mathrm{FS}}}\times100
$$

Além da Flash, deverão ser monitorados:

-   heap livre;
-   fragmentação;
-   tamanho das estruturas temporais;
-   buffers HTTP;
-   impacto de modelos TinyML.

------------------------------------------------------------------------

## 21. TinyML

### Situação: pesquisa futura

TinyML poderá permitir inferência local baseada em padrões aprendidos.

Um vetor de entrada conceitual pode ser:

$$
\mathbf{x}=[T,RH,P,\bar{T}_{15},\bar{RH}_{15},m_P,T_d]
$$

Um modelo de classificação poderá produzir:

$$
\mathbf{p}=[p_1,p_2,\ldots,p_k]
$$

com:

$$
\sum_{i=1}^{k}p_i=1
$$

O objetivo não é introduzir aprendizado de máquina apenas por
complexidade, mas investigar se modelos aprendidos superam regras
determinísticas em tarefas específicas.

------------------------------------------------------------------------

## 22. Detecção inteligente de anomalias

Uma aplicação potencial do TinyML é aprender o comportamento normal da
própria estação.

Em uma abordagem estatística simples, um desvio padronizado pode ser
calculado por:

$$
z=\frac{x-\mu}{\sigma}
$$

onde:

-   $x$ = observação;
-   $\mu$ = média de referência;
-   $\sigma$ = desvio padrão.

O desvio padrão amostral é:

$$
s=\sqrt{\frac{\sum_{i=1}^{N}(x_i-\bar{x})^2}{N-1}}
$$

Modelos futuros poderão considerar múltiplas variáveis simultaneamente.

------------------------------------------------------------------------

## 23. Integração com assistentes e LLMs

### Situação: exploratória

A integração futura pode permitir consultas como:

``` text
"Qual é a temperatura da estação?"

"A pressão está caindo?"

"Houve algum alerta hoje?"
```

Uma arquitetura segura deve evitar expor diretamente o ESP32 à Internet.

Preferência arquitetural:

``` text
ESP32
  │
  ▼
backend Cloud
  │
  ▼
serviço de integração
  │
  ├──► assistente de voz
  └──► LLM
```

Assim, o microcontrolador permanece protegido atrás da camada de
serviços.

------------------------------------------------------------------------

## 24. Múltiplas estações

### Situação: evolução futura

A Cloud permite transformar o projeto em uma rede de nós Edge.

``` text
Estação A ─┐
Estação B ─┼──► Cloud ──► análise conjunta
Estação C ─┘
```

Para $E$ estações, cada uma gerando $N$ registros:

$$
N_{\mathrm{total}}=E\times N
$$

Isso abre possibilidades de comparação espacial e estudo de microclimas.

------------------------------------------------------------------------

## 25. Eficiência energética

### Situação: possibilidade futura

Se a estação evoluir para alimentação por bateria ou energia solar,
consumo passará a ser variável crítica.

A energia consumida aproximadamente é:

$$
E=P\times t
$$

e, para tensão $V$ e corrente $I$:

$$
P=V\times I
$$

logo:

$$
E=V\times I\times t
$$

Estratégias futuras podem incluir:

-   deep sleep;
-   redução de frequência de transmissão;
-   aquisição adaptativa;
-   acionamento seletivo de sensores;
-   processamento local para reduzir comunicação.

------------------------------------------------------------------------

## 26. Segurança

Evoluções futuras devem fortalecer:

-   gestão de credenciais;
-   autenticação do dashboard remoto;
-   políticas RLS;
-   validação de payloads;
-   OTA seguro;
-   rotação de chaves;
-   proteção de configurações;
-   princípio do menor privilégio.

Segredos administrativos nunca devem ser incorporados ao repositório
público.

------------------------------------------------------------------------

## 27. Observabilidade

### Situação: planejada como evolução

Além dos dados ambientais, a estação poderá produzir métricas
operacionais:

-   uptime;
-   resets;
-   heap livre;
-   RSSI;
-   falhas de sensor;
-   falhas de API;
-   falhas Cloud;
-   tamanho da fila;
-   número de reenvios;
-   versão do firmware.

Isso permitirá distinguir:

``` text
problema ambiental
```

de:

``` text
problema do próprio sistema
```

------------------------------------------------------------------------

## 28. Possibilidades acadêmicas

A plataforma permite investigar temas como:

-   Edge Computing;
-   IoT;
-   resiliência Edge--Cloud;
-   redução de tráfego;
-   latência;
-   eficiência energética;
-   processamento distribuído;
-   TinyML;
-   detecção de anomalias;
-   séries temporais;
-   comparação Edge × Cloud;
-   impacto ambiental de arquiteturas computacionais.

A estação pode funcionar como bancada experimental para medir
quantitativamente diferentes estratégias.

------------------------------------------------------------------------

## 29. Critérios para novas funcionalidades

Antes de incorporar uma funcionalidade, recomenda-se avaliar:

``` text
1. Qual problema ela resolve?
2. Deve executar no Edge ou na Cloud?
3. Funciona sem Internet?
4. Quanto consome de Flash?
5. Quanto consome de RAM?
6. Aumenta tráfego?
7. Introduz risco de segurança?
8. Pode ser testada isoladamente?
9. Como será documentada?
10. Como será validada?
```

Para comparar alternativas, métricas quantitativas podem ser utilizadas.

Por exemplo, redução percentual de tráfego:

$$
R_{\mathrm{tráfego}}=
\left(
1-\frac{D_{\mathrm{Edge}}}{D_{\mathrm{referência}}}
\right)\times100
$$

onde:

-   $D_{\mathrm{Edge}}$ = volume transmitido pela estratégia Edge;
-   $D_{\mathrm{referência}}$ = volume transmitido pela arquitetura de
    referência.

------------------------------------------------------------------------

## 30. Visão de longo prazo

A evolução conceitual pode ser representada por:

``` text
ESTAÇÃO AMBIENTAL
       │
       ▼
NÓ EDGE AUTÔNOMO
       │
       ▼
EDGE + CLOUD
       │
       ▼
HISTÓRICO E OBSERVABILIDADE
       │
       ▼
REDE DE ESTAÇÕES
       │
       ▼
TINYML / INFERÊNCIA LOCAL
       │
       ▼
SISTEMA DISTRIBUÍDO INTELIGENTE
```

O objetivo não é simplesmente acumular funcionalidades.

A evolução deve permitir estudar **onde processar, o que transmitir,
como manter autonomia e qual benefício é obtido ao deslocar inteligência
da Cloud para a borda**.

------------------------------------------------------------------------

## 31. Resumo

O roadmap organiza a evolução em três grandes horizontes:

``` text
CURTO PRAZO
├── consolidar v3.4
├── dashboard remoto
├── eventos Cloud
└── resiliência de telemetria

MÉDIO PRAZO
├── OTA
├── modularização
├── observabilidade
├── histórico avançado
└── múltiplas estações

LONGO PRAZO
├── TinyML
├── anomalias inteligentes
├── eficiência energética
├── assistentes / LLMs
└── experimentos acadêmicos Edge × Cloud
```

A diretriz central permanece:

> **preservar a autonomia do Edge e utilizar a Cloud para ampliar
> persistência, integração, acesso e capacidade analítica.**
