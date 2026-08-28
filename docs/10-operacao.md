# Operação da Estação Ambiental ESP32

Este documento descreve a operação cotidiana da **Estação Ambiental
ESP32**, incluindo inicialização, leitura do dashboard, interpretação
dos indicadores, eventos, conectividade, configuração e procedimentos
básicos de diagnóstico.

> Documento referente à operação consolidada na fase **v3.4-RC1** do
> projeto.

------------------------------------------------------------------------

## Índice

-   [1. Visão geral](#1-visão-geral)
-   [2. Objetivo deste documento](#2-objetivo-deste-documento)
-   [3. Fluxo operacional](#3-fluxo-operacional)
-   [4. Inicialização da estação](#4-inicialização-da-estação)
-   [5. Heartbeat do ESP32](#5-heartbeat-do-esp32)
-   [6. Acesso ao dashboard local](#6-acesso-ao-dashboard-local)
-   [7. Leitura dos sensores](#7-leitura-dos-sensores)
-   [8. Temperatura](#8-temperatura)
-   [9. Umidade relativa](#9-umidade-relativa)
-   [10. Pressão atmosférica](#10-pressão-atmosférica)
-   [11. Pressão ao nível do mar](#11-pressão-ao-nível-do-mar)
-   [12. Média móvel de 15 minutos](#12-média-móvel-de-15-minutos)
-   [13. Histórico de 60 minutos](#13-histórico-de-60-minutos)
-   [14. Mínimos e máximos diários](#14-mínimos-e-máximos-diários)
-   [15. Ponto de orvalho](#15-ponto-de-orvalho)
-   [16. Tendência barométrica](#16-tendência-barométrica)
-   [17. Estados ambientais](#17-estados-ambientais)
-   [18. Histerese temporal](#18-histerese-temporal)
-   [19. Instabilidade e anomalias](#19-instabilidade-e-anomalias)
-   [20. Alertas](#20-alertas)
-   [21. Eventos](#21-eventos)
-   [22. Dados externos Open-Meteo](#22-dados-externos-open-meteo)
-   [23. Comparação local e externa](#23-comparação-local-e-externa)
-   [24. Indicador Wi-Fi](#24-indicador-wi-fi)
-   [25. Operação da Cloud](#25-operação-da-cloud)
-   [26. Configurações](#26-configurações)
-   [27. Reinicialização e
    persistência](#27-reinicialização-e-persistência)
-   [28. Operação sem Internet](#28-operação-sem-internet)
-   [29. Diagnóstico básico](#29-diagnóstico-básico)
-   [30. Rotina recomendada de
    verificação](#30-rotina-recomendada-de-verificação)
-   [31. Resumo](#31-resumo)

------------------------------------------------------------------------

## 1. Visão geral

Depois de instalada e configurada, a estação foi projetada para operar
de forma autônoma.

O fluxo básico é:

``` text
energizar
   │
   ▼
inicializar
   │
   ▼
conectar à rede
   │
   ▼
ler sensores
   │
   ▼
processar no Edge
   │
   ├──► dashboard local
   ├──► eventos
   ├──► Open-Meteo
   └──► Supabase
```

A operação normal não exige conexão USB permanente com um computador.

------------------------------------------------------------------------

## 2. Objetivo deste documento

Este documento é voltado ao uso da estação já instalada.

Para instalação, gravação do firmware e configuração inicial, consulte:

``` text
09-instalacao.md
```

Para detalhes internos dos algoritmos, consulte:

``` text
04-firmware.md
11-processamento-edge.md
```

------------------------------------------------------------------------

## 3. Fluxo operacional

Em funcionamento contínuo, a estação executa ciclos de aquisição e
processamento.

A periodicidade principal é aproximadamente:

$$
\Delta t=60\ \mathrm{s}
$$

A frequência correspondente é:

$$
f_s=\frac{1}{\Delta t}
$$

portanto:

$$
f_s=\frac{1}{60}\ \mathrm{Hz}\approx0.0167\ \mathrm{Hz}
$$

A cada ciclo, novos dados podem atualizar médias, extremos, tendências,
estados, gráficos e telemetria.

------------------------------------------------------------------------

## 4. Inicialização da estação

Após energização ou reset, ocorre aproximadamente:

``` text
BOOT
 │
 ├── inicialização do ESP32
 ├── montagem do LittleFS
 ├── leitura da NVS
 ├── inicialização dos sensores
 ├── recuperação das configurações
 ├── conexão Wi-Fi
 ├── inicialização do servidor Web
 ├── inicialização do mDNS
 ├── conexão com serviços externos
 └── início da aquisição
```

Nos primeiros minutos, alguns indicadores que dependem de histórico
ainda podem aparecer como indisponíveis ou em formação.

Isso é esperado.

------------------------------------------------------------------------

## 5. Heartbeat do ESP32

O LED da placa funciona como indicador simples de atividade.

O padrão adotado é composto por dois pulsos curtos seguidos por um
período maior de repouso.

Conceitualmente:

``` text
ON  ─ 100 ms
OFF ─ 100 ms
ON  ─ 100 ms
OFF ─ aproximadamente 1 s
```

O heartbeat não substitui o diagnóstico pelo dashboard ou Serial
Monitor, mas fornece indicação visual de que o firmware está em
execução.

------------------------------------------------------------------------

## 6. Acesso ao dashboard local

Na rede local, utilize preferencialmente:

``` text
http://estacao-ambiental.local
```

Se o hostname tiver sido alterado:

``` text
http://<hostname>.local
```

Caso mDNS não funcione, utilize o endereço IP atribuído ao ESP32.

O aviso **Não seguro** do navegador é esperado no acesso HTTP local.

------------------------------------------------------------------------

## 7. Leitura dos sensores

A estação utiliza principalmente:

``` text
BMP180
├── temperatura
└── pressão

DHT11
├── umidade
└── temperatura auxiliar
```

O dashboard pode apresentar as grandezas locais juntamente com valores
derivados.

É importante distinguir:

``` text
MEDIDO
→ produzido diretamente pelo sensor

CALCULADO
→ derivado pelo ESP32

EXTERNO
→ obtido de serviço meteorológico
```

------------------------------------------------------------------------

## 8. Temperatura

A temperatura principal da arquitetura Cloud é a fornecida pelo BMP180.

A leitura instantânea representa o estado térmico no local físico do
sensor.

Ela pode diferir de uma estação meteorológica externa devido a:

-   posição;
-   ventilação;
-   incidência solar;
-   altura;
-   ambiente interno ou externo;
-   características do sensor;
-   instante de aquisição.

------------------------------------------------------------------------

## 9. Umidade relativa

A umidade relativa é obtida pelo DHT11 e expressa em porcentagem.

Ela representa aproximadamente a relação entre a quantidade de vapor
presente no ar e a quantidade máxima possível para aquela condição
térmica.

O valor é utilizado também em cálculos derivados e classificações
ambientais.

------------------------------------------------------------------------

## 10. Pressão atmosférica

O BMP180 mede a pressão correspondente à altitude física da estação.

Essa pressão local não deve ser comparada diretamente com valores
meteorológicos ao nível do mar sem considerar a altitude.

Por isso, o dashboard distingue pressão local e pressão corrigida.

------------------------------------------------------------------------

## 11. Pressão ao nível do mar

Uma forma de estimativa utilizada é:

$$
P_0=P\left(1-\frac{0.0065h}{T+0.0065h+273.15}\right)^{-5.257}
$$

onde:

-   $P_0$ = pressão estimada ao nível do mar;
-   $P$ = pressão local;
-   $h$ = altitude em metros;
-   $T$ = temperatura em °C.

A altitude configurada influencia diretamente o resultado.

Portanto, se a pressão corrigida parecer incoerente, verifique também a
altitude cadastrada.

------------------------------------------------------------------------

## 12. Média móvel de 15 minutos

A média móvel reduz a influência de pequenas oscilações instantâneas.

Para $N$ amostras:

$$
\bar{x}_N=\frac{1}{N}\sum_{i=1}^{N}x_i
$$

Com uma leitura por minuto, a janela de 15 minutos utiliza
aproximadamente:

$$
N=15
$$

e:

$$
\bar{x}_{15}=\frac{x_{t-14}+x_{t-13}+\cdots+x_t}{15}
$$

Logo após a inicialização, a média ainda está sendo formada.

------------------------------------------------------------------------

## 13. Histórico de 60 minutos

O dashboard local trabalha com aproximadamente uma hora recente.

Com uma leitura por minuto:

$$
N_{60}\approx60
$$

A janela é:

$$
W_{60}(t)=\{x_{t-59},x_{t-58},\ldots,x_t\}
$$

Quando uma nova leitura entra após a janela estar completa, a mais
antiga é removida.

Por isso, depois de um reboot o gráfico precisa novamente acumular
histórico.

------------------------------------------------------------------------

## 14. Mínimos e máximos diários

Para as amostras válidas do dia:

$$
x_{\min}=\min(x_1,x_2,\ldots,x_n)
$$

$$
x_{\max}=\max(x_1,x_2,\ldots,x_n)
$$

Se $x_j$ for o mínimo:

$$
x_j=x_{\min}
$$

então:

$$
t_{\min}=t_j
$$

Se $x_k$ for o máximo:

$$
x_k=x_{\max}
$$

então:

$$
t_{\max}=t_k
$$

Os extremos são reiniciados de acordo com o ciclo diário definido pelo
firmware.

------------------------------------------------------------------------

## 15. Ponto de orvalho

O ponto de orvalho é calculado a partir de temperatura e umidade.

Pela aproximação de Magnus:

$$
\gamma=\ln\left(\frac{RH}{100}\right)+\frac{aT}{b+T}
$$

$$
T_d=\frac{b\gamma}{a-\gamma}
$$

onde $T_d$ é o ponto de orvalho.

Esse indicador ajuda a interpretar a quantidade de vapor presente no ar
e a proximidade de condições de condensação.

------------------------------------------------------------------------

## 16. Tendência barométrica

A estação utiliza o histórico da pressão para avaliar sua tendência.

O comportamento pode ser aproximado por:

$$
P(t)=mt+b
$$

O coeficiente angular é:

$$
m=\frac{N\sum_{i=1}^{N}t_iP_i-\left(\sum_{i=1}^{N}t_i\right)\left(\sum_{i=1}^{N}P_i\right)}{N\sum_{i=1}^{N}t_i^2-\left(\sum_{i=1}^{N}t_i\right)^2}
$$

De forma geral:

-   $m>0$: pressão em tendência de subida;
-   $m$ próximo de zero: pressão relativamente estável;
-   $m<0$: pressão em tendência de queda.

Após um reboot, é necessário acumular histórico suficiente antes que a
tendência tenha significado operacional.

------------------------------------------------------------------------

## 17. Estados ambientais

O dashboard converte resultados numéricos em informações mais
interpretáveis.

Exemplos:

``` text
umidade
├── seca
├── moderada
└── elevada

pressão
├── subindo
├── estável
└── caindo

conforto
├── confortável
└── desconfortável
```

Os estados são produzidos no ESP32.

------------------------------------------------------------------------

## 18. Histerese temporal

Algumas mudanças de estado não são confirmadas imediatamente.

Se $t_c$ é o tempo de permanência de uma nova condição e $T_H$ o tempo
mínimo de confirmação:

$$
t_c\ge T_H
$$

é a condição necessária para confirmar a transição.

Isso evita alternâncias rápidas provocadas por pequenas oscilações
próximas a um limiar.

------------------------------------------------------------------------

## 19. Instabilidade e anomalias

O indicador de instabilidade utiliza características ambientais e
histórico para gerar uma interpretação local.

Ele deve ser entendido como **heurística experimental**, e não como
previsão meteorológica profissional.

A detecção de anomalias procura condições consideradas fora do
comportamento esperado segundo as regras do firmware.

Esses indicadores são especialmente úteis para experimentação em
Computação de Borda.

------------------------------------------------------------------------

## 20. Alertas

Alertas aparecem quando uma condição definida pelo firmware exige
destaque.

O fluxo conceitual é:

``` text
medição
  │
  ▼
processamento
  │
  ▼
estado
  │
  ▼
condição relevante?
  │
  └──► alerta
```

O usuário deve interpretar um alerta juntamente com os valores
ambientais e o histórico disponível.

------------------------------------------------------------------------

## 21. Eventos

A área de eventos registra mudanças relevantes.

Exemplos:

``` text
Sistema iniciado
API conectada
API indisponível
Cloud conectada
Cloud indisponível
Cloud recuperada
mudança de estado
alerta
```

O log privilegia transições, evitando repetir indefinidamente o mesmo
estado.

A lista local possui tamanho limitado.

------------------------------------------------------------------------

## 22. Dados externos Open-Meteo

Quando há Internet, a estação consulta dados meteorológicos externos.

Eles podem incluir:

-   temperatura;
-   temperatura aparente;
-   umidade;
-   ponto de orvalho;
-   pressão;
-   precipitação;
-   nuvens;
-   visibilidade;
-   UV;
-   vento;
-   rajadas;
-   condição meteorológica.

Esses valores devem ser interpretados como **referência externa**, não
como substitutos dos sensores locais.

------------------------------------------------------------------------

## 23. Comparação local e externa

Para uma variável disponível nas duas fontes:

$$
\Delta x=x_{\mathrm{local}}-x_{\mathrm{externo}}
$$

Para temperatura:

$$
\Delta T=T_{\mathrm{local}}-T_{\mathrm{externa}}
$$

Se:

$$
\Delta T>0
$$

a leitura local é superior à referência externa.

Se:

$$
\Delta T<0
$$

a leitura local é inferior.

Diferenças são esperadas porque as duas fontes não necessariamente
representam o mesmo microambiente.

------------------------------------------------------------------------

## 24. Indicador Wi-Fi

O dashboard apresenta RSSI em dBm.

Como os valores são normalmente negativos:

``` text
-50 dBm → sinal mais forte
-80 dBm → sinal mais fraco
```

A potência em dBm é definida por:

$$
P_{\mathrm{dBm}}=10\log_{10}\left(\frac{P}{1\ \mathrm{mW}}\right)
$$

RSSI baixo pode explicar falhas intermitentes de serviços externos.

------------------------------------------------------------------------

## 25. Operação da Cloud

Quando o Supabase está disponível, snapshots são enviados
periodicamente.

O fluxo é:

``` text
ESP32
  │
  ▼
HTTPS
  │
  ▼
Supabase
  │
  ▼
public.leituras
```

Uma falha Cloud não deve interromper a aquisição local.

O dashboard pode registrar eventos de indisponibilidade e recuperação.

------------------------------------------------------------------------

## 26. Configurações

O botão de configurações permite administrar parâmetros como:

-   identificação;
-   hostname;
-   Wi-Fi;
-   localização;
-   altitude.

Alterações devem ser feitas com atenção, principalmente em:

``` text
Wi-Fi
hostname
altitude
```

pois afetam respectivamente conectividade, endereço local e cálculo
barométrico.

------------------------------------------------------------------------

## 27. Reinicialização e persistência

Parâmetros armazenados em NVS permanecem após reboot.

Já estruturas mantidas apenas em RAM podem ser reconstruídas após a
inicialização.

Por isso, depois de reiniciar podem ocorrer temporariamente:

-   gráfico vazio ou incompleto;
-   média em formação;
-   tendência aguardando histórico;
-   lista de eventos reiniciada.

Isso não indica necessariamente falha.

------------------------------------------------------------------------

## 28. Operação sem Internet

Se a Internet cair, mas a rede local permanecer:

``` text
Sensores ✓
Processamento Edge ✓
Dashboard local ✓
mDNS ✓
Open-Meteo ✕
Supabase ✕
```

Essa é uma característica central da arquitetura.

A estação continua sendo funcional como nó Edge mesmo sem Cloud.

------------------------------------------------------------------------

## 29. Diagnóstico básico

### Dashboard não abre

Verifique:

1.  ESP32 energizado;
2.  heartbeat;
3.  Wi-Fi;
4.  endereço mDNS;
5.  IP direto.

### Sensores sem leitura

Verifique:

1.  alimentação;
2.  conexões;
3.  GPIO;
4.  I²C;
5.  mensagens no Serial Monitor.

### Open-Meteo indisponível

Verifique:

1.  Wi-Fi;
2.  Internet;
3.  evento de API;
4.  configuração de localização.

### Cloud indisponível

Verifique:

1.  Internet;
2.  eventos CLOUD;
3.  Supabase;
4.  política RLS;
5.  credencial configurada.

### Dashboard sem estilo ou scripts

Provável causa:

``` text
LittleFS ausente, incompleto ou desatualizado
```

------------------------------------------------------------------------

## 30. Rotina recomendada de verificação

Uma inspeção operacional simples pode seguir:

``` text
1. LED heartbeat está ativo?
          │
          ▼
2. Dashboard abre?
          │
          ▼
3. Sensores apresentam valores?
          │
          ▼
4. Histórico está sendo formado?
          │
          ▼
5. Wi-Fi está adequado?
          │
          ▼
6. Open-Meteo está conectado?
          │
          ▼
7. Cloud está conectada?
          │
          ▼
8. Existem alertas ou eventos anormais?
```

Essa sequência começa pelas funções locais e só depois verifica
dependências externas.

------------------------------------------------------------------------

## 31. Resumo

A operação da estação segue uma hierarquia:

``` text
NÍVEL 1
hardware e sensores
      │
      ▼
NÍVEL 2
processamento Edge
      │
      ▼
NÍVEL 3
dashboard local
      │
      ▼
NÍVEL 4
serviços externos
      │
      ▼
NÍVEL 5
Cloud e acesso remoto
```

Ao diagnosticar problemas, recomenda-se seguir essa mesma ordem.

A prioridade operacional é preservar a capacidade de **medir, processar
e interpretar localmente**, utilizando Internet e Cloud como extensões
da plataforma.
