# Processamento Edge da Estação Ambiental ESP32

Este documento descreve o processamento executado localmente pela
**Estação Ambiental ESP32**, destacando a transformação de dados brutos
dos sensores em informação ambiental interpretável antes de qualquer
dependência da Cloud.

> Documento referente à arquitetura de processamento consolidada na fase
> **v3.4-RC1** do projeto.

------------------------------------------------------------------------

## Índice

-   [1. Visão geral](#1-visão-geral)
-   [2. O que caracteriza o processamento
    Edge](#2-o-que-caracteriza-o-processamento-edge)
-   [3. Pipeline de processamento](#3-pipeline-de-processamento)
-   [4. Aquisição](#4-aquisição)
-   [5. Validação das amostras](#5-validação-das-amostras)
-   [6. Organização temporal](#6-organização-temporal)
-   [7. Janela móvel de 60 minutos](#7-janela-móvel-de-60-minutos)
-   [8. Média móvel de 15 minutos](#8-média-móvel-de-15-minutos)
-   [9. Mínimos e máximos diários](#9-mínimos-e-máximos-diários)
-   [10. Pressão ao nível do mar](#10-pressão-ao-nível-do-mar)
-   [11. Ponto de orvalho](#11-ponto-de-orvalho)
-   [12. Variação da pressão](#12-variação-da-pressão)
-   [13. Tendência barométrica por regressão
    linear](#13-tendência-barométrica-por-regressão-linear)
-   [14. Classificação ambiental](#14-classificação-ambiental)
-   [15. Histerese temporal](#15-histerese-temporal)
-   [16. Estado de umidade](#16-estado-de-umidade)
-   [17. Estado de conforto](#17-estado-de-conforto)
-   [18. Instabilidade atmosférica](#18-instabilidade-atmosférica)
-   [19. Detecção de anomalias](#19-detecção-de-anomalias)
-   [20. Alertas](#20-alertas)
-   [21. Eventos](#21-eventos)
-   [22. Dados locais e referência
    externa](#22-dados-locais-e-referência-externa)
-   [23. Redução de dados e agregação](#23-redução-de-dados-e-agregação)
-   [24. Latência de decisão](#24-latência-de-decisão)
-   [25. Operação independente da
    Cloud](#25-operação-independente-da-cloud)
-   [26. Edge versus processamento
    centralizado](#26-edge-versus-processamento-centralizado)
-   [27. Fluxo matemático completo](#27-fluxo-matemático-completo)
-   [28. Preparação para TinyML](#28-preparação-para-tinyml)
-   [29. Relevância acadêmica](#29-relevância-acadêmica)
-   [30. Resumo](#30-resumo)

------------------------------------------------------------------------

## 1. Visão geral

Os sensores da estação produzem grandezas físicas, mas o sistema não se
limita a transmiti-las.

O ESP32 executa localmente uma sequência de operações:

``` text
SENSOR
   │
   ▼
AQUISIÇÃO
   │
   ▼
VALIDAÇÃO
   │
   ▼
ORGANIZAÇÃO TEMPORAL
   │
   ▼
PROCESSAMENTO MATEMÁTICO
   │
   ▼
EXTRAÇÃO DE CARACTERÍSTICAS
   │
   ▼
CLASSIFICAÇÃO
   │
   ▼
EVENTOS / ALERTAS
   │
   ├──► DASHBOARD LOCAL
   └──► CLOUD
```

Esse pipeline é um dos elementos que caracteriza o projeto como uma
aplicação de **Computação de Borda**.

------------------------------------------------------------------------

## 2. O que caracteriza o processamento Edge

Um sistema que apenas lê um sensor e transmite seu valor executa
sensoriamento e comunicação.

Na estação, o ESP32 também produz nova informação.

Por exemplo:

``` text
pressão medida
      │
      ├──► correção para nível do mar
      ├──► média temporal
      ├──► variação
      └──► tendência
```

Da mesma forma:

``` text
temperatura + umidade
          │
          ▼
     ponto de orvalho
          │
          ▼
   estado ambiental
```

Portanto, parte da interpretação ocorre antes que os dados deixem o
dispositivo.

------------------------------------------------------------------------

## 3. Pipeline de processamento

O processamento pode ser dividido em camadas:

``` text
Camada 1 ─ aquisição
Camada 2 ─ validação
Camada 3 ─ armazenamento temporal
Camada 4 ─ agregação
Camada 5 ─ extração de características
Camada 6 ─ classificação
Camada 7 ─ decisão
Camada 8 ─ apresentação / telemetria
```

Cada camada utiliza resultados produzidos pela anterior.

------------------------------------------------------------------------

## 4. Aquisição

A estação utiliza atualmente:

``` text
BMP180
├── temperatura
└── pressão

DHT11
├── umidade
└── temperatura auxiliar
```

A periodicidade principal é aproximadamente:

$$
\Delta t=60\ \mathrm{s}
$$

A frequência de amostragem correspondente é:

$$
f_s=\frac{1}{\Delta t}
$$

portanto:

$$
f_s=\frac{1}{60}\ \mathrm{Hz}
$$

ou aproximadamente:

$$
f_s\approx0.0167\ \mathrm{Hz}
$$

Essa frequência é adequada para grandezas ambientais cuja dinâmica é
relativamente lenta.

------------------------------------------------------------------------

## 5. Validação das amostras

Antes de utilizar uma leitura em cálculos derivados, o firmware deve
verificar se ela é válida.

Conceitualmente:

``` text
leitura
  │
  ▼
válida?
  │
 ┌┴┐
não sim
 │   │
 ▼   ▼
ignorar
     │
     ▼
incorporar ao histórico
```

Amostras inválidas não devem contaminar médias, extremos ou tendências.

Se existirem (N) posições em uma janela e apenas (n) forem válidas, os
cálculos devem utilizar:

$$
1\le n\le N
$$

e não assumir automaticamente que todas as posições possuem dados
confiáveis.

------------------------------------------------------------------------

## 6. Organização temporal

Cada amostra pode ser representada como um par:

$$
(t_i,x_i)
$$

onde:

-   $t_i$ é o instante da medição;
-   $x_i$ é o valor medido.

Uma série temporal é então:

$$
X=\{(t_1,x_1),(t_2,x_2),\ldots,(t_N,x_N)\}
$$

Essa estrutura permite analisar não apenas valores, mas também sua
evolução.

------------------------------------------------------------------------

## 7. Janela móvel de 60 minutos

A estação mantém aproximadamente uma hora de histórico recente.

Com amostragem de um minuto:

$$
N_{60}\approx60
$$

A janela pode ser representada por:

$$
W_{60}(t)=\{x_{t-59},x_{t-58},\ldots,x_t\}
$$

Quando a janela está cheia, a chegada de uma nova amostra provoca a
remoção da mais antiga.

Isso limita o uso de memória:

$$
N\le N_{\mathrm{max}}
$$

em vez de permitir crescimento indefinido.

------------------------------------------------------------------------

## 8. Média móvel de 15 minutos

A média móvel simples de uma janela com $N$ amostras é:

$$
\bar{x}_N=\frac{1}{N}\sum_{i=1}^{N}x_i
$$

Para 15 amostras de um minuto:

$$
\bar{x}_{15}=\frac{x_{t-14}+x_{t-13}+\cdots+x_t}{15}
$$

Enquanto a janela ainda não está completa, podem ser utilizadas apenas
as $n$ amostras válidas disponíveis:

$$
\bar{x}=\frac{1}{n}\sum_{i=1}^{n}x_i
$$

com:

$$
1\le n\le15
$$

A média móvel atua como uma forma simples de suavização temporal.

------------------------------------------------------------------------

## 9. Mínimos e máximos diários

Para as amostras válidas do dia:

$$
D=\{x_1,x_2,\ldots,x_n\}
$$

o mínimo é:

$$
x_{\min}=\min(x_1,x_2,\ldots,x_n)
$$

e o máximo:

$$
x_{\max}=\max(x_1,x_2,\ldots,x_n)
$$

Se a amostra $x_j$ corresponde ao mínimo:

$$
x_j=x_{\min}
$$

então:

$$
t_{\min}=t_j
$$

Analogamente, se:

$$
x_k=x_{\max}
$$

então:

$$
t_{\max}=t_k
$$

Assim, o Edge mantém não apenas os extremos, mas também o momento em que
ocorreram.

------------------------------------------------------------------------

## 10. Pressão ao nível do mar

A pressão atmosférica varia com a altitude.

Uma forma barométrica utilizada para estimar a pressão equivalente ao
nível do mar é:

$$
P_0=P\left(1-\frac{0.0065h}{T+0.0065h+273.15}\right)^{-5.257}
$$

onde:

-   $P_0$ é a pressão estimada ao nível do mar;
-   $P$ é a pressão medida;
-   $h$ é a altitude da estação em metros;
-   $T$ é a temperatura em °C.

Esse cálculo transforma uma leitura local em uma grandeza mais
apropriada para comparação meteorológica.

------------------------------------------------------------------------

## 11. Ponto de orvalho

O ponto de orvalho não é medido diretamente.

Ele é derivado de temperatura e umidade relativa.

Pela aproximação de Magnus:

$$
\gamma=\ln\left(\frac{RH}{100}\right)+\frac{aT}{b+T}
$$

e:

$$
T_d=\frac{b\gamma}{a-\gamma}
$$

onde:

-   $T_d$ é o ponto de orvalho;
-   $T$ é a temperatura;
-   $RH$ é a umidade relativa.

Uma parametrização comum utiliza:

$$
a=17.62
$$

$$
b=243.12
$$

Esse é um exemplo claro de **feature engineering no Edge**: duas
medições são transformadas em uma terceira variável ambiental
significativa.

------------------------------------------------------------------------

## 12. Variação da pressão

Uma diferença simples de pressão pode ser calculada por:

$$
\Delta P=P_{\mathrm{atual}}-P_{\mathrm{anterior}}
$$

Para uma janela temporal $\Delta t$:

$$
\Delta P_{\Delta t}=P(t)-P(t-\Delta t)
$$

Uma taxa média de variação pode ser expressa por:

$$
r_P=\frac{\Delta P}{\Delta t}
$$

Se pressão estiver em hPa e tempo em horas:

$$
r_P\rightarrow\mathrm{hPa/h}
$$

------------------------------------------------------------------------

## 13. Tendência barométrica por regressão linear

Utilizar apenas duas leituras pode tornar a análise sensível a ruído.

Por isso, uma tendência pode ser estimada ajustando:

$$
P(t)=mt+b
$$

O coeficiente angular é:

$$
m=\frac{N\sum_{i=1}^{N}t_iP_i-\left(\sum_{i=1}^{N}t_i\right)\left(\sum_{i=1}^{N}P_i\right)}{N\sum_{i=1}^{N}t_i^2-\left(\sum_{i=1}^{N}t_i\right)^2}
$$

e o intercepto:

$$
b=\frac{\sum_{i=1}^{N}P_i-m\sum_{i=1}^{N}t_i}{N}
$$

Quando $t$ está em horas e $P$ em hPa:

$$
m\rightarrow\mathrm{hPa/h}
$$

De forma geral:

-   $m>0$: tendência crescente;
-   $m$ próximo de zero: tendência estável;
-   $m<0$: tendência decrescente.

A classificação efetiva depende dos limiares definidos no firmware.

------------------------------------------------------------------------

## 14. Classificação ambiental

Após calcular características, o firmware converte valores contínuos em
estados discretos.

De forma geral, para uma variável $x$ e limiares $L_1$ e $L_2$:

$$
C(x)=
\begin{cases}
C_1, & x<L_1 \\
C_2, & L_1\le x<L_2 \\
C_3, & x\ge L_2
\end{cases}
$$

No firmware real, os estados e limiares devem corresponder às regras
implementadas.

A vantagem da classificação é transformar números em informação
operacional.

------------------------------------------------------------------------

## 15. Histerese temporal

Uma leitura pode oscilar em torno de um limiar.

Sem histerese:

``` text
NORMAL → ALERTA → NORMAL → ALERTA
```

poderia ocorrer rapidamente.

A histerese temporal exige persistência da condição.

Se $t_c$ é o tempo durante o qual uma nova condição permaneceu válida e
$T_H$ é o tempo mínimo de confirmação:

$$
t_c\ge T_H
$$

somente então a mudança de estado é confirmada.

Conceitualmente:

$$
S_{\mathrm{novo}}=
\begin{cases}
S_{\mathrm{candidato}}, & t_c\ge T_H \\
S_{\mathrm{anterior}}, & t_c<T_H
\end{cases}
$$

Isso reduz oscilações de classificação.

------------------------------------------------------------------------

## 16. Estado de umidade

A umidade relativa é convertida em categorias ambientais.

Conceitualmente, para limiares $H_1$ e $H_2$:

$$
Estado_H=
\begin{cases}
seco, & RH<H_1 \\
moderado, & H_1\le RH<H_2 \\
elevado, & RH\ge H_2
\end{cases}
$$

Os valores de $H_1$ e $H_2$ devem ser aqueles efetivamente definidos no
firmware.

------------------------------------------------------------------------

## 17. Estado de conforto

O estado de conforto combina informação ambiental para produzir uma
interpretação mais direta ao usuário.

Conceitualmente:

``` text
temperatura
     +
umidade
     │
     ▼
regra de conforto
     │
     ▼
estado
```

Quando a regra utiliza intervalos, ela pode ser descrita genericamente
por:

$$
Conforto=
\begin{cases}
1, & T_{\min}\le T\le T_{\max}\ \text{e}\ RH_{\min}\le RH\le RH_{\max} \\
0, & \text{caso contrário}
\end{cases}
$$

Os limites concretos devem refletir o código da versão documentada.

------------------------------------------------------------------------

## 18. Instabilidade atmosférica

A estação combina comportamento da pressão e histórico para produzir uma
indicação de instabilidade.

Conceitualmente:

``` text
pressão atual
     +
média / histórico
     +
tendência
     │
     ▼
heurística
     │
     ▼
instabilidade
```

Esse indicador é uma **heurística local**, e não uma previsão
meteorológica formal.

Sua importância arquitetural está em demonstrar que o nó Edge pode
combinar múltiplas características para produzir uma decisão de nível
superior.

------------------------------------------------------------------------

## 19. Detecção de anomalias

Uma anomalia pode ser entendida como uma observação que viola regras ou
padrões esperados.

Em um detector baseado em limiar, por exemplo:

$$
A(x)=
\begin{cases}
1, & x<L_{\min}\ \text{ou}\ x>L_{\max} \\
0, & \text{caso contrário}
\end{cases}
$$

onde:

-   $A=1$ representa condição anômala;
-   $A=0$ representa condição normal.

O projeto pode futuramente substituir ou complementar regras fixas por
modelos estatísticos ou TinyML.

------------------------------------------------------------------------

## 20. Alertas

Alertas são produzidos a partir de estados ou condições relevantes.

O fluxo é:

``` text
características
      │
      ▼
classificação
      │
      ▼
condição relevante?
      │
    ┌─┴─┐
   não sim
    │   │
    ▼   ▼
   fim alerta
```

O alerta é, portanto, resultado de processamento e não uma grandeza
física diretamente medida.

------------------------------------------------------------------------

## 21. Eventos

Eventos representam mudanças significativas.

Se $S(t)$ é o estado atual e $S(t-1)$ o anterior, uma mudança pode ser
detectada por:

$$
S(t)\ne S(t-1)
$$

Nesse caso, pode ser gerado um evento.

Essa lógica evita registrar continuamente mensagens idênticas enquanto o
sistema permanece no mesmo estado.

------------------------------------------------------------------------

## 22. Dados locais e referência externa

A estação também recebe dados da Open-Meteo.

Para uma grandeza presente localmente e externamente:

$$
\Delta x=x_{\mathrm{local}}-x_{\mathrm{externo}}
$$

Para temperatura:

$$
\Delta T=T_{\mathrm{local}}-T_{\mathrm{externa}}
$$

Para pressão:

$$
\Delta P=P_{\mathrm{local}}-P_{\mathrm{externa}}
$$

Essas diferenças não representam necessariamente erro do sensor, pois as
fontes podem possuir localização, altitude, horário e método de medição
distintos.

------------------------------------------------------------------------

## 23. Redução de dados e agregação

O Edge pode reduzir a necessidade de transmitir todos os detalhes
intermediários.

Por exemplo, para $N$ amostras, uma média:

$$
\bar{x}=\frac{1}{N}\sum_{i=1}^{N}x_i
$$

condensa múltiplos valores em uma característica.

A razão de redução, em um caso simplificado onde $N$ amostras são
substituídas por um único valor agregado, pode ser representada por:

$$
R=\frac{N}{1}=N
$$

Entretanto, na estação atual, a Cloud ainda recebe snapshots periódicos
ricos para preservar o histórico. A agregação Edge é utilizada
principalmente para interpretação, não como substituição completa dos
dados temporais.

------------------------------------------------------------------------

## 24. Latência de decisão

Uma vantagem do Edge é não precisar aguardar ida e volta à Cloud para
interpretar uma medição.

Em uma arquitetura centralizada:

$$
T_{\mathrm{decisão}}=
T_{\mathrm{upload}}+
T_{\mathrm{rede}}+
T_{\mathrm{processamentoCloud}}+
T_{\mathrm{retorno}}
$$

No Edge, de forma simplificada:

$$
T_{\mathrm{decisãoEdge}}\approx T_{\mathrm{processamentoLocal}}
$$

Assim:

$$
T_{\mathrm{decisãoEdge}}<T_{\mathrm{decisãoCloud}}
$$

em condições típicas nas quais a decisão Cloud depende de comunicação de
rede.

A vantagem torna-se ainda mais importante quando a Internet está
indisponível.

------------------------------------------------------------------------

## 25. Operação independente da Cloud

O pipeline local continua disponível sem Supabase:

``` text
Sensores
   │
   ▼
ESP32
   │
   ├── médias
   ├── tendências
   ├── estados
   ├── eventos
   ├── alertas
   └── dashboard local
```

A Cloud acrescenta persistência e acesso remoto.

Ela não é o local primário da decisão ambiental imediata.

------------------------------------------------------------------------

## 26. Edge versus processamento centralizado

### Arquitetura centralizada

``` text
Sensor
  │
  ▼
dados brutos
  │
  ▼
Cloud
  │
  ├── processamento
  ├── classificação
  └── decisão
```

### Arquitetura da estação

``` text
Sensor
  │
  ▼
ESP32
  │
  ├── processamento
  ├── classificação
  ├── decisão
  └── telemetria
         │
         ▼
       Cloud
```

Essa mudança de posição do processamento é central ao conceito de Edge
Computing.

------------------------------------------------------------------------

## 27. Fluxo matemático completo

Um exemplo simplificado para temperatura, umidade e pressão é:

``` text
T, RH, P
   │
   ├──► média temporal
   │
   ├──► mínimos / máximos
   │
   ├──► T + RH ──► ponto de orvalho
   │
   ├──► P + altitude + T ──► pressão ao nível do mar
   │
   └──► histórico de P ──► regressão ──► tendência
                                      │
                                      ▼
                               classificação
                                      │
                               ┌──────┴──────┐
                               ▼             ▼
                            eventos       alertas
```

Em notação funcional, o processamento pode ser representado como:

$$
F(T,RH,P,h,X_t)\rightarrow Y
$$

onde:

-   $T$ = temperatura;
-   $RH$ = umidade relativa;
-   $P$ = pressão;
-   $h$ = altitude;
-   $X_t$ = histórico temporal;
-   $Y$ = conjunto de características, estados e alertas produzidos.

Assim, o dado transmitido pode ser entendido como:

$$
Y=f(X)
$$

e não simplesmente como uma cópia direta de $X$.

------------------------------------------------------------------------

## 28. Preparação para TinyML

A arquitetura atual já executa uma forma clássica de pipeline de
inteligência:

``` text
dados
  │
  ▼
features
  │
  ▼
regras
  │
  ▼
classificação
```

Uma evolução TinyML pode alterar principalmente a etapa de decisão:

``` text
dados
  │
  ▼
features
  │
  ▼
modelo treinado
  │
  ▼
inferência local
```

Por exemplo, um modelo poderia receber um vetor:

$$
\mathbf{x}=
[T,\ RH,\ P,\ \bar{T}_{15},\ \bar{RH}_{15},\ m_P,\ T_d]
$$

e produzir probabilidades para classes ambientais:

$$
\mathbf{p}=[p_1,p_2,\ldots,p_k]
$$

com:

$$
\sum_{i=1}^{k}p_i=1
$$

A classe prevista seria aquela associada à maior probabilidade.

Essa etapa é futura e não faz parte da funcionalidade consolidada da
v3.4-RC1.

------------------------------------------------------------------------

## 29. Relevância acadêmica

A estação permite demonstrar experimentalmente conceitos importantes de
Computação de Borda:

-   aquisição distribuída;
-   processamento próximo à fonte;
-   agregação;
-   extração de características;
-   tomada de decisão local;
-   redução de dependência da rede;
-   tolerância a falhas Cloud;
-   integração Edge--Cloud;
-   séries temporais;
-   evolução para TinyML.

O projeto permite comparar, de forma concreta, três níveis:

``` text
Nível 1
Sensor → leitura

Nível 2
Sensor → Edge → informação

Nível 3
Sensor → Edge → informação → Cloud → histórico
```

Essa progressão ajuda a distinguir um simples sistema IoT de uma
arquitetura com processamento efetivo na borda.

------------------------------------------------------------------------

## 30. Resumo

O processamento Edge da estação transforma:

``` text
DADO FÍSICO
     │
     ▼
DADO DIGITAL
     │
     ▼
INFORMAÇÃO DERIVADA
     │
     ▼
ESTADO
     │
     ▼
DECISÃO
```

O ESP32 não atua apenas como ponte entre sensores e Internet.

Ele executa aquisição, agregação, cálculos, análise temporal,
classificação, detecção de eventos e geração de alertas localmente.

Esse é um dos fundamentos técnicos que tornam a **Estação Ambiental
ESP32** uma plataforma experimental de Computação de Borda.
