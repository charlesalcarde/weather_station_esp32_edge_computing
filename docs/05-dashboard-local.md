# Dashboard Local da Estação Ambiental ESP32

Este documento descreve a interface Web local da **Estação Ambiental
ESP32**, sua organização no LittleFS, responsabilidades, fluxo de
atualização e relação com o processamento executado no nó Edge.

> Documento referente ao dashboard consolidado na fase **v3.4-RC1** do
> projeto.

------------------------------------------------------------------------

## Índice

-   [1. Visão geral](#1-visão-geral)
-   [2. Objetivo do dashboard local](#2-objetivo-do-dashboard-local)
-   [3. Arquitetura da interface](#3-arquitetura-da-interface)
-   [4. Organização dos arquivos](#4-organização-dos-arquivos)
    -   [4.1 index.html](#41-indexhtml)
    -   [4.2 style.css](#42-stylecss)
    -   [4.3 app.js](#43-appjs)
    -   [4.4 favicon.png](#44-faviconpng)
-   [5. Fluxo de dados](#5-fluxo-de-dados)
-   [6. Informações ambientais](#6-informações-ambientais)
-   [7. Indicadores derivados no Edge](#7-indicadores-derivados-no-edge)
    -   [7.1 Médias móveis](#71-médias-móveis)
    -   [7.2 Pressão ao nível do mar](#72-pressão-ao-nível-do-mar)
    -   [7.3 Ponto de orvalho](#73-ponto-de-orvalho)
    -   [7.4 Tendência barométrica](#74-tendência-barométrica)
-   [8. Histórico e gráficos](#8-histórico-e-gráficos)
-   [9. Estados ambientais](#9-estados-ambientais)
-   [10. Mínimos e máximos](#10-mínimos-e-máximos)
-   [11. Eventos](#11-eventos)
-   [12. Dados meteorológicos
    externos](#12-dados-meteorológicos-externos)
-   [13. Comparação local e externa](#13-comparação-local-e-externa)
-   [14. Configurações](#14-configurações)
-   [15. Wi-Fi e conectividade](#15-wi-fi-e-conectividade)
-   [16. mDNS e acesso local](#16-mdns-e-acesso-local)
-   [17. Modos claro e escuro](#17-modos-claro-e-escuro)
-   [18. Separação entre frontend e
    firmware](#18-separação-entre-frontend-e-firmware)
-   [19. LittleFS](#19-littlefs)
-   [20. Operação sem Internet](#20-operação-sem-internet)
-   [21. Segurança do acesso local](#21-segurança-do-acesso-local)
-   [22. Diferença entre dashboard local e
    remoto](#22-diferença-entre-dashboard-local-e-remoto)
-   [23. Evoluções futuras](#23-evoluções-futuras)
-   [24. Resumo](#24-resumo)

------------------------------------------------------------------------

## 1. Visão geral

O ESP32 disponibiliza uma interface Web própria para visualização e
configuração da estação.

O navegador acessa diretamente o servidor HTTP executado no
microcontrolador:

``` text
Navegador
    │
    │ HTTP / rede local
    ▼
  ESP32
    │
    ├── dados ambientais
    ├── estados
    ├── eventos
    └── arquivos LittleFS
```

Assim, a interface local não depende de um servidor Web externo para
apresentar as informações produzidas pela estação.

------------------------------------------------------------------------

## 2. Objetivo do dashboard local

O dashboard possui três funções principais:

-   visualização operacional;
-   diagnóstico da estação;
-   configuração local.

Ele permite observar tanto os valores medidos quanto as informações
produzidas pelo processamento Edge.

Por isso, sua função não é simplesmente apresentar dados brutos de
sensores.

O fluxo conceitual é:

``` text
sensores
   │
   ▼
ESP32
   │
   ├── cálculos
   ├── classificação
   ├── tendências
   ├── eventos
   └── alertas
        │
        ▼
   Dashboard local
```

------------------------------------------------------------------------

## 3. Arquitetura da interface

A interface utiliza tecnologias Web convencionais:

``` text
HTML
 │
 ├── estrutura
 │
CSS
 │
 ├── apresentação
 │
JavaScript
 │
 ├── comportamento
 │
 └── atualização dinâmica
```

Esses componentes são armazenados separadamente do firmware C++.

------------------------------------------------------------------------

## 4. Organização dos arquivos

A interface está localizada na pasta `data/` do projeto:

``` text
firmware/
└── estacao_ambiental/
    ├── EstacaoAmbiental.ino
    ├── partitions.csv
    │
    └── data/
        ├── index.html
        ├── style.css
        ├── app.js
        └── favicon.png
```

### 4.1 index.html

Define a estrutura semântica da página.

Contém os elementos que recebem:

-   valores ambientais;
-   indicadores;
-   gráficos;
-   estados;
-   eventos;
-   informações meteorológicas;
-   controles de configuração.

### 4.2 style.css

Responsável pela apresentação visual.

Controla elementos como:

-   layout;
-   tipografia;
-   cards;
-   espaçamentos;
-   responsividade;
-   modais;
-   modo claro;
-   modo escuro;
-   indicadores visuais.

### 4.3 app.js

Contém a lógica executada no navegador.

Entre suas responsabilidades estão:

-   solicitar dados ao ESP32;
-   interpretar respostas;
-   atualizar os elementos HTML;
-   atualizar gráficos;
-   controlar modais;
-   tratar ações do usuário;
-   atualizar estados visuais;
-   apresentar eventos e informações externas.

### 4.4 favicon.png

É o ícone visual da estação utilizado no navegador e na identidade do
dashboard.

------------------------------------------------------------------------

## 5. Fluxo de dados

O dashboard funciona como consumidor das informações produzidas pelo
firmware.

``` text
Sensores
   │
   ▼
Firmware
   │
   ▼
Processamento Edge
   │
   ▼
Estrutura de dados
   │
   ▼
Servidor HTTP
   │
   ▼
JavaScript
   │
   ▼
DOM / gráficos
   │
   ▼
Usuário
```

A interpretação ambiental principal ocorre no ESP32, não no navegador.

------------------------------------------------------------------------

## 6. Informações ambientais

O dashboard apresenta informações como:

-   temperatura;
-   umidade relativa;
-   pressão local;
-   pressão corrigida ao nível do mar;
-   média móvel;
-   mínimos e máximos;
-   ponto de orvalho;
-   tendência da pressão;
-   estado de umidade;
-   conforto;
-   instabilidade;
-   anomalias;
-   alertas.

Também são apresentadas informações operacionais, como conectividade e
eventos.

------------------------------------------------------------------------

## 7. Indicadores derivados no Edge

Diversos valores apresentados no dashboard não são fornecidos
diretamente pelos sensores. Eles são calculados pelo firmware.

### 7.1 Médias móveis

Para uma janela com (N) amostras:

$$
\bar{x}_N=\frac{1}{N}\sum_{i=1}^{N}x_i
$$

Na janela de 15 minutos, com uma amostra por minuto:

$$
\bar{x}_{15}=\frac{x_{t-14}+x_{t-13}+\cdots+x_t}{15}
$$

A média reduz a influência de pequenas oscilações instantâneas.

### 7.2 Pressão ao nível do mar

A pressão medida pelo BMP180 depende da altitude da estação.

Uma forma usual da correção é:

$$
P_0=P\left(1-\frac{0.0065h}{T+0.0065h+273.15}\right)^{-5.257}
$$

onde:

-   (P_0) = pressão estimada ao nível do mar;
-   \(P\) = pressão medida;
-   \(h\) = altitude em metros;
-   \(T\) = temperatura em °C.

O dashboard pode apresentar a pressão corrigida para facilitar a
interpretação meteorológica.

### 7.3 Ponto de orvalho

O ponto de orvalho é derivado de temperatura e umidade.

Pela aproximação de Magnus:

$$
\gamma=\ln\left(\frac{RH}{100}\right)+\frac{aT}{b+T}
$$

$$
T_d=\frac{b\gamma}{a-\gamma}
$$

onde (T_d) é o ponto de orvalho, (T) é a temperatura e (RH) é a umidade
relativa.

Uma parametrização comum utiliza:

$$
a=17.62
$$

$$
b=243.12
$$

### 7.4 Tendência barométrica

A tendência pode ser estimada ajustando uma reta:

$$
P(t)=mt+b
$$

O coeficiente angular é:

$$
m=\frac{N\sum_{i=1}^{N}t_iP_i-\left(\sum_{i=1}^{N}t_i\right)\left(\sum_{i=1}^{N}P_i\right)}{N\sum_{i=1}^{N}t_i^2-\left(\sum_{i=1}^{N}t_i\right)^2}
$$

Quando o tempo é expresso em horas e a pressão em hPa, (m) representa
uma taxa em hPa/h.

De maneira geral:

-   (m\>0): tendência de subida;
-   \(m\) próximo de zero: estabilidade;
-   (m\<0): tendência de queda.

Os limites de classificação devem permanecer coerentes com os definidos
no firmware.

------------------------------------------------------------------------

## 8. Histórico e gráficos

A interface utiliza uma janela móvel de aproximadamente 60 minutos.

Com uma amostra por minuto:

$$
N\approx60
$$

O histórico pode ser representado por:

$$
W_{60}(t)=\{x_{t-59},x_{t-58},\ldots,x_t\}
$$

Quando uma nova amostra é inserida após a janela estar completa, a mais
antiga é descartada.

Conceitualmente:

``` text
antes

x1 x2 x3 ... x59 x60

nova amostra = x61

depois

x2 x3 x4 ... x60 x61
```

Isso mantém uma quantidade limitada de dados no Edge e é apropriado à
memória disponível no microcontrolador.

------------------------------------------------------------------------

## 9. Estados ambientais

O dashboard apresenta classificações geradas pelo firmware.

Exemplos:

``` text
Umidade
├── seca
├── moderada
└── elevada

Pressão
├── subindo
├── estável
└── caindo

Conforto
├── confortável
└── desconfortável
```

A interface apenas representa visualmente esses estados; a lógica de
decisão permanece no Edge.

------------------------------------------------------------------------

## 10. Mínimos e máximos

Para as amostras válidas de uma grandeza durante o dia:

$$
x_{\min}=\min(x_1,x_2,\ldots,x_n)
$$

$$
x_{\max}=\max(x_1,x_2,\ldots,x_n)
$$

Se (x_j=x\_{`\min`{=tex}}), então o horário do mínimo é:

$$
t_{\min}=t_j
$$

Se (x_k=x\_{`\max`{=tex}}), então:

$$
t_{\max}=t_k
$$

O dashboard apresenta os extremos e seus respectivos horários quando
disponíveis.

Os valores são reiniciados no início de um novo ciclo diário.

------------------------------------------------------------------------

## 11. Eventos

O dashboard possui uma área destinada aos eventos recentes.

Podem ser registrados acontecimentos como:

-   inicialização do sistema;
-   conexão de Wi-Fi;
-   conexão com Open-Meteo;
-   falha ou recuperação da API;
-   conexão com Supabase;
-   falha ou recuperação da Cloud;
-   mudança de estado ambiental;
-   alertas.

A lista local mantém apenas uma quantidade limitada de eventos recentes
para evitar crescimento indefinido da memória utilizada.

------------------------------------------------------------------------

## 12. Dados meteorológicos externos

A interface também apresenta informações obtidas da Open-Meteo.

Entre elas podem estar:

-   temperatura;
-   temperatura aparente;
-   umidade;
-   ponto de orvalho;
-   pressão;
-   precipitação;
-   chuva;
-   probabilidade de precipitação;
-   cobertura de nuvens;
-   visibilidade;
-   índice UV;
-   vento;
-   direção;
-   rajadas;
-   condição meteorológica.

Esses dados são identificados como externos para não serem confundidos
com as medições realizadas fisicamente pela estação.

------------------------------------------------------------------------

## 13. Comparação local e externa

A presença simultânea de sensores locais e dados meteorológicos externos
permite observar diferenças entre:

``` text
microambiente local
        ×
referência meteorológica externa
```

Para uma grandeza disponível nas duas fontes, uma diferença simples pode
ser calculada por:

$$
\Delta x=x_{\mathrm{local}}-x_{\mathrm{externo}}
$$

Para temperatura:

$$
\Delta T=T_{\mathrm{local}}-T_{\mathrm{externa}}
$$

Um valor positivo de (`\Delta `{=tex}T) indica que a estação mede
temperatura superior à referência externa; um valor negativo indica o
contrário.

Essa diferença deve ser interpretada com cautela, pois as fontes podem
representar locais, alturas, instrumentos e instantes de medição
diferentes.

------------------------------------------------------------------------

## 14. Configurações

O dashboard possui interface para parâmetros da estação.

Entre os elementos configuráveis estão:

-   identidade da estação;
-   hostname local;
-   redes Wi-Fi;
-   localização;
-   cidade;
-   altitude.

As configurações persistentes são armazenadas pelo firmware em NVS.

------------------------------------------------------------------------

## 15. Wi-Fi e conectividade

A interface auxilia no processo de provisionamento da estação.

O firmware pode:

1.  procurar redes disponíveis;
2.  identificar redes já conhecidas;
3.  conectar-se automaticamente;
4.  iniciar modo Access Point quando necessário;
5.  permitir cadastro de nova rede;
6.  persistir as informações válidas.

A configuração de rede não exige alteração manual do código-fonte para
cada instalação.

------------------------------------------------------------------------

## 16. mDNS e acesso local

O endereço padrão é:

``` text
http://estacao-ambiental.local
```

O mDNS associa um nome amigável ao endereço IP da estação dentro da rede
local.

O hostname pode ser configurável.

A resolução `.local` depende de suporte a mDNS no dispositivo cliente e
na rede.

------------------------------------------------------------------------

## 17. Modos claro e escuro

O dashboard possui apresentação em modo claro e escuro.

Essa funcionalidade pertence à camada de interface e não altera os
algoritmos ambientais.

A separação entre apresentação e processamento permite modificar a
aparência sem alterar a lógica de aquisição e análise.

------------------------------------------------------------------------

## 18. Separação entre frontend e firmware

Uma decisão arquitetural importante foi retirar HTML, CSS e JavaScript
do sketch principal.

Em vez de grandes strings incorporadas ao C++, utiliza-se:

``` text
Firmware
   │
   ├── lógica
   ├── sensores
   ├── rede
   └── API

LittleFS
   │
   ├── HTML
   ├── CSS
   ├── JavaScript
   └── imagens
```

Isso melhora organização, manutenção e evolução da interface.

------------------------------------------------------------------------

## 19. LittleFS

Os arquivos Web são gravados em uma partição própria da Flash.

Na tabela personalizada atual:

``` text
LittleFS ≈ 704 KiB
```

O upload do firmware e o upload do filesystem são operações distintas.

Portanto, uma atualização apenas do `.ino` não substitui automaticamente
os arquivos da interface.

Da mesma forma, um upload do LittleFS não substitui o firmware.

------------------------------------------------------------------------

## 20. Operação sem Internet

Uma característica importante do dashboard local é que sua operação
básica não depende da Internet.

Com Wi-Fi local disponível:

``` text
Computador / celular
        │
        ▼
      roteador
        │
        ▼
       ESP32
```

é possível acessar as medições e o processamento Edge mesmo que a
conexão externa esteja indisponível.

Nessa situação, dados da Open-Meteo e serviços Cloud podem ficar
indisponíveis, mas o núcleo local continua operando.

------------------------------------------------------------------------

## 21. Segurança do acesso local

O dashboard utiliza atualmente HTTP na rede local.

Por isso, navegadores podem apresentar a indicação:

``` text
Não seguro
```

Isso significa que a conexão HTTP local não utiliza TLS/HTTPS.

O acesso local deve ser considerado diferente do futuro acesso remoto
pela Internet, que deverá utilizar HTTPS e mecanismos apropriados de
autenticação.

A estação não deve ser exposta diretamente à Internet por simples
redirecionamento de portas.

------------------------------------------------------------------------

## 22. Diferença entre dashboard local e remoto

A arquitetura prevê dois dashboards com finalidades distintas.

### Dashboard local

Executado pelo ESP32.

Prioridades:

-   operação;
-   diagnóstico;
-   configuração;
-   independência da Internet;
-   visualização do estado imediato.

### Dashboard remoto

Planejado para execução em infraestrutura Web.

Prioridades:

-   acesso remoto;
-   histórico de longo prazo;
-   comparação entre períodos;
-   análise sazonal;
-   visualização de dados Cloud;
-   futuras integrações.

Arquitetura prevista:

``` text
                 ┌── Dashboard local
                 │
Sensores → ESP32 ┤
                 │
                 └── Supabase → Dashboard remoto
```

O dashboard remoto não substitui o local.

------------------------------------------------------------------------

## 23. Evoluções futuras

Entre as possíveis evoluções da interface estão:

-   dashboard remoto;
-   seleção de períodos históricos;
-   comparação diária, mensal e sazonal;
-   visualização de eventos Cloud;
-   múltiplas estações;
-   indicadores de qualidade da telemetria;
-   estado do buffer de reenvio;
-   status de OTA;
-   apresentação de inferências TinyML.

A interface deverá continuar refletindo claramente quais informações
são:

``` text
medidas
calculadas
classificadas
externas
armazenadas na Cloud
```

Essa distinção é importante para a interpretação correta dos dados.

------------------------------------------------------------------------

## 24. Resumo

O dashboard local constitui a interface operacional do nó Edge.

Seu papel pode ser resumido por:

``` text
ESP32
 │
 ├── mede
 ├── calcula
 ├── interpreta
 └── disponibiliza
          │
          ▼
     Dashboard local
          │
          ▼
        usuário
```

A interface é servida diretamente pelo microcontrolador e permanece
separada da infraestrutura Cloud, reforçando a autonomia local da
**Estação Ambiental ESP32**.
