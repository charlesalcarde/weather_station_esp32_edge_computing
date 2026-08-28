# Conectividade da Estação Ambiental ESP32

Este documento descreve a arquitetura de conectividade da **Estação
Ambiental ESP32**, incluindo Wi-Fi, múltiplas redes conhecidas,
provisionamento, Access Point de configuração, persistência em NVS,
mDNS, comunicação HTTP/HTTPS e comportamento diante de falhas de rede.

> Documento referente à arquitetura de conectividade consolidada na fase
> **v3.4-RC1** do projeto.

------------------------------------------------------------------------

## Índice

-   [1. Visão geral](#1-visão-geral)
-   [2. Papel da conectividade na arquitetura
    Edge](#2-papel-da-conectividade-na-arquitetura-edge)
-   [3. Arquitetura de rede](#3-arquitetura-de-rede)
-   [4. Modos de operação Wi-Fi](#4-modos-de-operação-wi-fi)
    -   [4.1 Station Mode](#41-station-mode)
    -   [4.2 Access Point de
        configuração](#42-access-point-de-configuração)
-   [5. Inicialização da
    conectividade](#5-inicialização-da-conectividade)
-   [6. Múltiplas redes conhecidas](#6-múltiplas-redes-conhecidas)
-   [7. Seleção automática de rede](#7-seleção-automática-de-rede)
    -   [7.1 RSSI](#71-rssi)
    -   [7.2 Interpretação do RSSI](#72-interpretação-do-rssi)
-   [8. Provisionamento de nova rede](#8-provisionamento-de-nova-rede)
-   [9. Validação antes da
    persistência](#9-validação-antes-da-persistência)
-   [10. Política de armazenamento de
    redes](#10-política-de-armazenamento-de-redes)
-   [11. NVS](#11-nvs)
-   [12. Portal de configuração](#12-portal-de-configuração)
-   [13. DNS e comportamento de portal
    cativo](#13-dns-e-comportamento-de-portal-cativo)
-   [14. mDNS](#14-mdns)
-   [15. Endereço IP e hostname](#15-endereço-ip-e-hostname)
-   [16. HTTP local](#16-http-local)
-   [17. HTTPS e acesso remoto](#17-https-e-acesso-remoto)
-   [18. Comunicação com Open-Meteo](#18-comunicação-com-open-meteo)
-   [19. Comunicação com Supabase](#19-comunicação-com-supabase)
-   [20. Dependências de
    conectividade](#20-dependências-de-conectividade)
-   [21. Operação durante falha da
    Internet](#21-operação-durante-falha-da-internet)
-   [22. Operação durante perda do Wi-Fi
    local](#22-operação-durante-perda-do-wi-fi-local)
-   [23. Reconexão](#23-reconexão)
-   [24. Eventos de conectividade](#24-eventos-de-conectividade)
-   [25. Qualidade do enlace](#25-qualidade-do-enlace)
-   [26. Segurança](#26-segurança)
-   [27. Acesso remoto seguro](#27-acesso-remoto-seguro)
-   [28. Tolerância a falhas
    Edge--Cloud](#28-tolerância-a-falhas-edgecloud)
-   [29. Evoluções futuras](#29-evoluções-futuras)
-   [30. Resumo](#30-resumo)

------------------------------------------------------------------------

## 1. Visão geral

A conectividade permite que a estação se comunique com três ambientes
distintos:

``` text
                     ESP32
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
      Rede local    Internet      Cloud
          │            │            │
          ▼            ▼            ▼
     Dashboard      Open-Meteo    Supabase
```

Apesar dessa integração, o projeto foi concebido para que a
conectividade externa não seja requisito para o processamento ambiental
básico.

------------------------------------------------------------------------

## 2. Papel da conectividade na arquitetura Edge

Em uma arquitetura puramente centralizada, os sensores poderiam depender
de um servidor remoto:

``` text
Sensores → rede → Cloud → processamento
```

A estação utiliza outro modelo:

``` text
Sensores → ESP32 → processamento Edge
                    │
                    ├── dashboard local
                    └── rede → serviços externos
```

Assim, a rede amplia as capacidades do nó Edge, mas não substitui sua
inteligência local.

------------------------------------------------------------------------

## 3. Arquitetura de rede

Em operação normal:

``` text
                    INTERNET
                       │
                 ┌─────┴─────┐
                 │  Roteador │
                 └─────┬─────┘
                       │ Wi-Fi
             ┌─────────┼─────────┐
             │                   │
             ▼                   ▼
           ESP32            computador /
             │                 celular
             │                   │
             └──── dashboard ────┘
```

O mesmo roteador normalmente fornece ao ESP32 acesso à rede local e à
Internet.

------------------------------------------------------------------------

## 4. Modos de operação Wi-Fi

### 4.1 Station Mode

No funcionamento normal, o ESP32 atua como estação Wi-Fi:

``` text
ESP32 ─────► Access Point / roteador
```

Nesse modo ele recebe um endereço IP da rede e pode:

-   servir o dashboard;
-   acessar Open-Meteo;
-   acessar Supabase;
-   responder via mDNS.

### 4.2 Access Point de configuração

Quando necessário, o ESP32 pode criar sua própria rede.

Exemplo:

``` text
EstacaoAmbiental-Setup
```

O fluxo passa a ser:

``` text
celular / computador
         │
         │ Wi-Fi
         ▼
       ESP32
         │
         ▼
portal de configuração
```

Esse modo permite provisionar a estação mesmo sem acesso prévio a uma
rede conhecida.

------------------------------------------------------------------------

## 5. Inicialização da conectividade

Uma sequência conceitual é:

``` text
BOOT
 │
 ▼
carregar NVS
 │
 ▼
obter redes conhecidas
 │
 ▼
escanear redes próximas
 │
 ▼
há rede conhecida disponível?
 │
 ├── sim ──► escolher candidata ──► conectar
 │
 └── não ──► iniciar modo de configuração
```

A lógica busca reduzir a necessidade de intervenção manual.

------------------------------------------------------------------------

## 6. Múltiplas redes conhecidas

A estação pode armazenar múltiplas credenciais Wi-Fi.

Isso permite deslocar o equipamento entre ambientes previamente
configurados sem recompilar o firmware.

Conceitualmente:

``` text
NVS
│
├── Rede 1
├── Rede 2
├── Rede 3
├── Rede 4
└── Rede 5
```

O firmware compara as redes detectadas com as redes conhecidas antes de
escolher uma candidata.

------------------------------------------------------------------------

## 7. Seleção automática de rede

Quando mais de uma rede conhecida está disponível, a intensidade do
sinal pode ser utilizada como critério de seleção.

### 7.1 RSSI

O ESP32 mede a potência recebida por meio do **RSSI --- Received Signal
Strength Indicator**.

O RSSI é normalmente expresso em dBm.

A potência em dBm é uma representação logarítmica:

$$
P_{\mathrm{dBm}}=10\log_{10}\left(\frac{P}{1\ \mathrm{mW}}\right)
$$

onde (P) é a potência recebida.

A relação inversa é:

$$
P=1\ \mathrm{mW}\times10^{P_{\mathrm{dBm}}/10}
$$

Por exemplo, como o RSSI Wi-Fi normalmente é negativo, um valor de (-50)
dBm representa sinal mais forte que (-80) dBm.

### 7.2 Interpretação do RSSI

Uma interpretação qualitativa aproximada pode ser:

                 RSSI Interpretação aproximada
  ------------------- --------------------------
    maior que -50 dBm muito forte
        -50 a -60 dBm forte
        -60 a -70 dBm utilizável
        -70 a -80 dBm fraco
    menor que -80 dBm muito fraco

Essas faixas são referências práticas e não constituem limites rígidos
do protocolo.

Se duas redes conhecidas (A) e (B) forem detectadas, e:

$$
RSSI_A>RSSI_B
$$

então (A) possui maior potência recebida, lembrando que os valores
normalmente são negativos.

Exemplo:

$$
-52>-76
$$

portanto, (-52) dBm corresponde ao sinal mais forte.

------------------------------------------------------------------------

## 8. Provisionamento de nova rede

O provisionamento permite cadastrar Wi-Fi sem alterar o código.

Fluxo:

``` text
usuário
  │
  ▼
seleciona rede
  │
  ▼
informa senha
  │
  ▼
ESP32 tenta conectar
  │
  ├── sucesso ──► salvar
  │
  └── falha ────► não substituir configuração válida
```

Essa abordagem protege a estação contra a persistência imediata de uma
credencial incorreta.

------------------------------------------------------------------------

## 9. Validação antes da persistência

A configuração é tratada de forma transacional.

O princípio é:

``` text
configuração atual válida
          │
          ▼
receber nova configuração
          │
          ▼
testar
          │
      ┌───┴───┐
    falha   sucesso
      │        │
      ▼        ▼
descartar    persistir
nova         nova
```

Isso reduz o risco de tornar o equipamento inacessível após um erro de
senha.

------------------------------------------------------------------------

## 10. Política de armazenamento de redes

O projeto prevê um número limitado de redes conhecidas.

Quando o limite é atingido e uma nova rede precisa ser adicionada, pode
ser aplicada uma política de descarte da entrada mais antiga.

Para uma fila ordenada por antiguidade:

``` text
mais antiga                     mais recente
    │                                │
    ▼                                ▼
[R1] [R2] [R3] [R4] [R5]
```

ao inserir (R6):

``` text
[R2] [R3] [R4] [R5] [R6]
```

Isso mantém o uso da NVS controlado.

------------------------------------------------------------------------

## 11. NVS

A **Non-Volatile Storage (NVS)** é utilizada para armazenar
configurações persistentes.

Entre elas podem estar:

-   SSIDs;
-   credenciais Wi-Fi;
-   hostname;
-   identidade da estação;
-   localização;
-   altitude;
-   outros parâmetros.

A NVS permanece disponível após reinicialização e desligamento.

Credenciais reais não devem ser incorporadas ao repositório Git.

------------------------------------------------------------------------

## 12. Portal de configuração

O portal local permite configurar a estação por navegador.

Isso elimina a necessidade de:

-   editar o sketch;
-   recompilar;
-   conectar por USB;
-   enviar novo firmware;

apenas para alterar parâmetros operacionais.

A interface de configuração faz parte do dashboard local.

------------------------------------------------------------------------

## 13. DNS e comportamento de portal cativo

Durante o modo Access Point, o ESP32 pode responder a consultas DNS de
forma a direcionar o usuário para a interface de configuração.

Conceitualmente:

``` text
cliente
  │
  ├── solicita endereço
  │
  ▼
DNS local no ESP32
  │
  ▼
192.168.4.1
```

O endereço típico do ESP32 em modo AP é:

``` text
192.168.4.1
```

O comportamento exato de detecção automática de portal cativo pode
variar entre sistemas operacionais.

------------------------------------------------------------------------

## 14. mDNS

Na rede local, o mDNS permite utilizar um nome amigável.

Exemplo:

``` text
estacao-ambiental.local
```

em vez de:

``` text
192.168.x.x
```

O hostname é configurável.

O mDNS funciona por descoberta local e não corresponde a um domínio DNS
público da Internet.

------------------------------------------------------------------------

## 15. Endereço IP e hostname

O endereço IP pode mudar conforme a configuração DHCP do roteador.

Por isso, o hostname mDNS melhora a experiência de acesso:

``` text
IP variável
192.168.1.37
192.168.1.54
192.168.1.102

       ↓ mDNS

estacao-ambiental.local
```

Isso reduz a dependência de conhecer o IP atual.

------------------------------------------------------------------------

## 16. HTTP local

O dashboard é servido pelo ESP32 utilizando HTTP.

Exemplo:

``` text
http://estacao-ambiental.local
```

A comunicação ocorre dentro da rede local.

O navegador pode indicar a conexão como **Não segura** porque HTTP não
utiliza criptografia TLS.

------------------------------------------------------------------------

## 17. HTTPS e acesso remoto

Implementar HTTPS diretamente no microcontrolador é possível em
determinadas arquiteturas, mas envolve certificados, TLS, gerenciamento
de chaves e consumo adicional de recursos.

Para este projeto, a estratégia prevista para acesso remoto é diferente:

``` text
ESP32
  │
  │ HTTPS
  ▼
Cloud
  │
  ▼
Dashboard remoto HTTPS
```

Assim, não é necessário expor diretamente o servidor Web local do ESP32
à Internet.

------------------------------------------------------------------------

## 18. Comunicação com Open-Meteo

O ESP32 acessa serviços externos pela Internet:

``` text
ESP32
  │
  ▼
roteador
  │
  ▼
Internet
  │
  ▼
Open-Meteo
```

Os dados externos são complementares.

Uma falha nesse caminho não deve interromper:

-   sensores;
-   processamento;
-   dashboard local;
-   estados ambientais.

------------------------------------------------------------------------

## 19. Comunicação com Supabase

A telemetria segue aproximadamente:

``` text
ESP32
  │
  │ REST / HTTPS
  ▼
Supabase
  │
  ▼
PostgreSQL
```

O firmware envia snapshots ambientais em intervalos definidos.

A indisponibilidade da Cloud deve ser tratada como falha de um serviço
externo, não como falha do nó Edge.

------------------------------------------------------------------------

## 20. Dependências de conectividade

As funcionalidades podem ser classificadas por dependência:

  Função                     Wi-Fi local   Internet   Cloud
  ------------------------- ------------- ---------- -------
  Leitura dos sensores           Não         Não       Não
  Processamento Edge             Não         Não       Não
  Estados ambientais             Não         Não       Não
  Heartbeat                      Não         Não       Não
  Dashboard via rede             Sim         Não       Não
  mDNS                           Sim         Não       Não
  Open-Meteo                     Sim         Sim       Não
  Supabase                       Sim         Sim       Sim
  Futuro dashboard remoto        ---         Sim       Sim

Essa tabela evidencia a autonomia do processamento local.

------------------------------------------------------------------------

## 21. Operação durante falha da Internet

Se o roteador continuar operando, mas perder acesso à Internet:

``` text
Internet ✕
    │
Roteador ✓
    │
   ESP32 ✓
```

continuam disponíveis:

-   aquisição;
-   processamento;
-   dashboard local;
-   mDNS;
-   eventos locais.

Ficam temporariamente indisponíveis:

-   Open-Meteo;
-   Supabase;
-   outros serviços externos.

------------------------------------------------------------------------

## 22. Operação durante perda do Wi-Fi local

Se o ESP32 perder a associação com o Access Point, o processamento dos
sensores continua.

Entretanto, o dashboard deixa temporariamente de ser acessível pela
rede.

A arquitetura deve tentar recuperar a conectividade sem interromper as
tarefas Edge.

------------------------------------------------------------------------

## 23. Reconexão

A lógica de reconexão deve evitar bloqueios prolongados.

Conceitualmente:

``` text
Wi-Fi caiu
   │
   ▼
registrar mudança
   │
   ▼
continuar Edge
   │
   ▼
aguardar intervalo
   │
   ▼
nova tentativa
```

Uma estratégia de evolução possível é o **backoff**.

Se $T_0$ for o intervalo inicial, um **backoff exponencial** pode ser descrito por:

$$
T_n = \min(T_{\mathrm{max}}, T_0 \cdot 2^n)
$$

onde:

- $T_n$ é o intervalo de espera após a tentativa $n$;
- $n$ é o número de tentativas consecutivas malsucedidas;
- $T_0$ é o intervalo inicial;
- $T_{\mathrm{max}}$ é o intervalo máximo permitido.

Por exemplo, se:

$$
T_0 = 5\ \mathrm{s}
$$

os primeiros intervalos seriam aproximadamente:

$$
5,\ 10,\ 20,\ 40,\ 80,\ldots
$$

até atingir o limite definido por $T_{\mathrm{max}}$.

Essa estratégia é uma possibilidade futura; sua adoção deve ser
refletida no código antes de ser considerada funcionalidade consolidada.

------------------------------------------------------------------------

## 24. Eventos de conectividade

O log local deve privilegiar transições de estado.

Em vez de registrar:

``` text
Cloud OK
Cloud OK
Cloud OK
Cloud OK
```

a cada envio, é preferível:

``` text
Cloud conectada
...
Cloud indisponível
...
Cloud recuperada
```

Isso reduz ruído e torna o histórico mais útil para diagnóstico.

------------------------------------------------------------------------

## 25. Qualidade do enlace

O RSSI pode ser apresentado no dashboard como indicador operacional.

Como a escala dBm é logarítmica, uma diferença de 10 dB corresponde a
uma razão de potência de:

$$
\frac{P_2}{P_1}=10^{10/10}=10
$$

Portanto, uma diferença de 10 dB representa uma razão de potência de 10
vezes.

Uma diferença de 3 dB corresponde aproximadamente a:

$$
10^{3/10}\approx2
$$

ou seja, aproximadamente o dobro da potência.

Isso não significa que alcance, velocidade ou qualidade percebida variem
linearmente na mesma proporção, pois Wi-Fi também depende de
interferência, ruído, obstáculos e modulação.

------------------------------------------------------------------------

## 26. Segurança

Algumas regras são fundamentais:

-   não publicar senhas Wi-Fi;
-   não publicar chaves secretas;
-   não utilizar credenciais administrativas no firmware;
-   não expor o ESP32 diretamente à Internet;
-   utilizar HTTPS para serviços externos;
-   limitar permissões das credenciais Cloud;
-   manter segredos fora do repositório público.

Uma chave de cliente com privilégios limitados é conceitualmente
diferente de uma chave administrativa.

O princípio deve ser o de **menor privilégio**.

------------------------------------------------------------------------

## 27. Acesso remoto seguro

O projeto não utiliza redirecionamento direto de portas do roteador para
o ESP32.

A arquitetura prevista é:

``` text
                  Internet
                     │
                     ▼
              Dashboard remoto
                     │
                     ▼
                  Cloud
                     ▲
                     │
                   HTTPS
                     │
                    ESP32
```

O ESP32 inicia conexões de saída para serviços conhecidos.

Isso reduz a superfície de exposição do dispositivo.

------------------------------------------------------------------------

## 28. Tolerância a falhas Edge--Cloud

Uma evolução importante é implementar buffer local para transmissões
malsucedidas.

Fluxo previsto:

``` text
snapshot
   │
   ▼
enviar Cloud
   │
 ┌─┴─┐
 │   │
OK  falha
 │   │
 ▼   ▼
fim  fila local
       │
       ▼
   reenvio posterior
```

Para uma fila com capacidade máxima (Q\_{`\max`{=tex}}):

$$
0\le Q\le Q_{\max}
$$

onde (Q) é o número de snapshots pendentes.

A fila deverá possuir política explícita para:

-   capacidade;
-   descarte;
-   ordem de reenvio;
-   identificação única;
-   prevenção de duplicidade;
-   intervalo entre tentativas.

Essa funcionalidade pertence ao roadmap e ainda não deve ser considerada
parte consolidada da versão atual.

------------------------------------------------------------------------

## 29. Evoluções futuras

A camada de conectividade poderá evoluir com:

-   fila resiliente de telemetria;
-   backoff de reconexão;
-   métricas de disponibilidade;
-   OTA;
-   dashboard remoto;
-   autenticação;
-   múltiplas estações;
-   monitoramento de qualidade da conexão;
-   integração com Alexa.

A arquitetura deve continuar preservando a regra:

> **falha de conectividade não deve equivaler a falha do processamento
> Edge.**

------------------------------------------------------------------------

## 30. Resumo

A conectividade da estação pode ser resumida por:

``` text
                         ┌── Dashboard local
                         │
Sensores → ESP32 Edge ───┼── Open-Meteo
                         │
                         └── Supabase
```

O Wi-Fi conecta o nó Edge a outros sistemas, mas a inteligência
ambiental principal permanece no próprio ESP32.

Essa separação é essencial para a autonomia, disponibilidade e evolução
da **Estação Ambiental ESP32**.
