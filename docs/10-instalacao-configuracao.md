# Instalação e Configuração da Estação Ambiental ESP32

Este documento descreve o procedimento para preparar o ambiente de
desenvolvimento, compilar, gravar e configurar a **Estação Ambiental
ESP32**.

> Procedimento de referência para a arquitetura consolidada na fase
> **v3.4-RC1**.

------------------------------------------------------------------------

## Índice

-   [1. Visão geral](#1-visão-geral)
-   [2. Pré-requisitos](#2-pré-requisitos)
-   [3. Estrutura do projeto](#3-estrutura-do-projeto)
-   [4. Hardware necessário](#4-hardware-necessário)
-   [5. Ligações dos sensores](#5-ligações-dos-sensores)
-   [6. Preparação do Arduino IDE](#6-preparação-do-arduino-ide)
-   [7. Suporte à placa ESP32](#7-suporte-à-placa-esp32)
-   [8. Bibliotecas](#8-bibliotecas)
-   [9. Abrindo o projeto](#9-abrindo-o-projeto)
-   [10. Seleção da placa e porta](#10-seleção-da-placa-e-porta)
-   [11. Flash física](#11-flash-física)
-   [12. Seleção da partição Custom](#12-seleção-da-partição-custom)
-   [13. Arquivo partitions.csv](#13-arquivo-partitionscsv)
-   [14. Compilação](#14-compilação)
-   [15. Verificação do tamanho real do
    firmware](#15-verificação-do-tamanho-real-do-firmware)
-   [16. Upload do firmware](#16-upload-do-firmware)
-   [17. Upload do LittleFS](#17-upload-do-littlefs)
-   [18. Primeira inicialização](#18-primeira-inicialização)
-   [19. Provisionamento Wi-Fi](#19-provisionamento-wi-fi)
-   [20. Acesso ao portal de
    configuração](#20-acesso-ao-portal-de-configuração)
-   [21. Configuração da estação](#21-configuração-da-estação)
-   [22. Configuração de localização e
    altitude](#22-configuração-de-localização-e-altitude)
-   [23. Acesso por mDNS](#23-acesso-por-mdns)
-   [24. Validação dos sensores](#24-validação-dos-sensores)
-   [25. Validação do dashboard](#25-validação-do-dashboard)
-   [26. Validação da Open-Meteo](#26-validação-da-open-meteo)
-   [27. Validação da Cloud](#27-validação-da-cloud)
-   [28. Checklist de homologação](#28-checklist-de-homologação)
-   [29. Solução de problemas](#29-solução-de-problemas)
-   [30. Atualizações futuras](#30-atualizações-futuras)
-   [31. Resumo](#31-resumo)

------------------------------------------------------------------------

## 1. Visão geral

A instalação completa possui duas gravações independentes:

``` text
Código C++ ─────────► partição APP
Arquivos data/ ─────► partição LittleFS
```

Portanto, o projeto não deve ser tratado como um único arquivo `.ino`.

------------------------------------------------------------------------

## 2. Pré-requisitos

São necessários:

-   ESP32 Dev Module compatível;
-   cabo USB de dados;
-   Arduino IDE;
-   suporte ESP32 instalado;
-   bibliotecas utilizadas pelo firmware;
-   uploader LittleFS compatível;
-   sensores BMP180 e DHT11;
-   acesso a uma rede Wi-Fi para os recursos externos.

Para configuração inicial, recomenda-se também manter o Serial Monitor
disponível para diagnóstico.

------------------------------------------------------------------------

## 3. Estrutura do projeto

A estrutura mínima deve ser preservada:

``` text
EstacaoAmbiental/
├── EstacaoAmbiental.ino
├── partitions.csv
└── data/
    ├── index.html
    ├── style.css
    ├── app.js
    └── favicon.png
```

O `partitions.csv` e a pasta `data/` são partes integrantes da versão
executável.

------------------------------------------------------------------------

## 4. Hardware necessário

A configuração principal utiliza:

  Componente     Função
  -------------- ------------------------------------
  ESP32          processamento Edge e conectividade
  BMP180         temperatura e pressão
  DHT11          umidade e temperatura auxiliar
  LED da placa   heartbeat operacional

A temperatura principal utilizada na telemetria Cloud é proveniente do
BMP180.

------------------------------------------------------------------------

## 5. Ligações dos sensores

### BMP180

O BMP180 utiliza barramento I²C:

``` text
BMP180       ESP32
VCC    ───► alimentação compatível
GND    ───► GND
SDA    ───► GPIO 21
SCL    ───► GPIO 22
```

### DHT11

``` text
DHT11        ESP32
VCC    ───► alimentação compatível
GND    ───► GND
DATA   ───► GPIO 4
```

### LED

O heartbeat utiliza:

``` text
GPIO 2
```

na configuração atual da placa.

> Antes de energizar módulos diferentes dos utilizados no protótipo,
> confirme a tensão e o pinout específicos do componente.

------------------------------------------------------------------------

## 6. Preparação do Arduino IDE

O Arduino IDE é utilizado para:

-   abrir o sketch;
-   compilar;
-   selecionar a placa;
-   selecionar a porta serial;
-   enviar o firmware;
-   acompanhar mensagens pela Serial.

O uploader LittleFS é utilizado separadamente para os arquivos Web.

------------------------------------------------------------------------

## 7. Suporte à placa ESP32

O ambiente deve possuir o pacote de placas ESP32 compatível com o
firmware.

Após a instalação, selecione:

``` text
ESP32 Dev Module
```

ou a opção correspondente à placa utilizada.

Mudanças significativas de versão do core ESP32 podem alterar
bibliotecas, APIs ou comportamento de ferramentas. Portanto, versões de
dependências devem ser registradas quando uma release for homologada.

------------------------------------------------------------------------

## 8. Bibliotecas

O firmware depende das bibliotecas correspondentes aos sensores,
filesystem, rede e demais recursos utilizados.

As dependências devem ser mantidas no repositório ou documentadas com:

``` text
nome
versão
origem
finalidade
```

Evite atualizar várias bibliotecas simultaneamente durante diagnóstico,
pois isso dificulta identificar a origem de uma regressão.

------------------------------------------------------------------------

## 9. Abrindo o projeto

Abra:

``` text
EstacaoAmbiental.ino
```

a partir da pasta que também contém:

``` text
partitions.csv
data/
```

Não mova apenas o `.ino` para outra pasta antes de compilar, pois o
layout personalizado depende do arquivo CSV associado ao sketch.

------------------------------------------------------------------------

## 10. Seleção da placa e porta

No Arduino IDE:

``` text
Board
└── ESP32 Dev Module
```

Selecione também a porta correspondente ao ESP32.

No ambiente utilizado durante o desenvolvimento, a placa apareceu em:

``` text
COM6
```

A porta pode ser diferente em outro computador.

------------------------------------------------------------------------

## 11. Flash física

A placa utilizada possui:

$$
4\ \mathrm{MiB}
$$

ou:

$$
4194304\ \mathrm{bytes}
$$

Portanto, mantenha a configuração física de Flash coerente com:

``` text
4MB
```

O uso de uma tabela `Custom` não altera a quantidade física de memória
instalada na placa.

------------------------------------------------------------------------

## 12. Seleção da partição Custom

O projeto utiliza uma tabela própria.

No menu de partições, selecione:

``` text
Custom
```

O objetivo é utilizar o arquivo:

``` text
partitions.csv
```

presente no projeto.

Essa configuração substitui o layout padrão de aplicação/filesystem por
um layout otimizado para a estação.

------------------------------------------------------------------------

## 13. Arquivo partitions.csv

O layout homologado é:

``` csv
# Name,   Type, SubType, Offset,   Size,     Flags
nvs,      data, nvs,     0x9000,   0x5000,
otadata,  data, ota,     0xE000,   0x2000,
app0,     app,  ota_0,   0x10000,  0x1A0000,
app1,     app,  ota_1,   0x1B0000, 0x1A0000,
spiffs,   data, spiffs,  0x350000, 0x0B0000,
```

Cada APP possui:

$$
0x1A0000=1703936\ \mathrm{bytes}
$$

e o filesystem:

$$
0x0B0000=720896\ \mathrm{bytes}
$$

ou:

$$
704\ \mathrm{KiB}
$$

------------------------------------------------------------------------

## 14. Compilação

Compile o projeto antes do upload.

A compilação deve confirmar:

-   ausência de erros;
-   geração do binário;
-   compatibilidade das bibliotecas;
-   tamanho inferior ao limite real de APP.

Não interprete isoladamente o percentual exibido pelo IDE no modo
`Custom`.

------------------------------------------------------------------------

## 15. Verificação do tamanho real do firmware

A capacidade real de cada partição de aplicação é:

$$
S_{\mathrm{APP}}=1703936\ \mathrm{bytes}
$$

Para um binário de tamanho $S_{\mathrm{bin}}$, a ocupação real é:

$$
U=\frac{S_{\mathrm{bin}}}{1703936}\times100
$$

A margem restante é:

$$
M=1703936-S_{\mathrm{bin}}
$$

Na homologação da v3.4-RC1, o binário possuía aproximadamente:

$$
S_{\mathrm{bin}}=1252016\ \mathrm{bytes}
$$

portanto:

$$
U\approx73.5\%
$$

e:

$$
M=451920\ \mathrm{bytes}
$$

ou aproximadamente 441 KiB.

------------------------------------------------------------------------

## 16. Upload do firmware

Com placa, porta e `Custom` selecionados:

1.  feche aplicações que estejam utilizando a porta serial, se
    necessário;
2.  execute o upload;
3.  aguarde a gravação e verificação;
4.  permita a reinicialização da placa.

O firmware é gravado na partição de aplicação correspondente.

------------------------------------------------------------------------

## 17. Upload do LittleFS

Depois do firmware, envie os arquivos da pasta:

``` text
data/
```

O filesystem homologado ocupa:

``` text
0x350000 até 0x400000
```

Seu tamanho é:

$$
0x400000-0x350000=0x0B0000
$$

O uploader deve reconhecer o `partitions.csv`.

Durante o processo homologado, foram identificados:

``` text
Start: 0x350000
End:   0x400000
```

Se a ferramenta indicar **No port specified** mesmo com uma porta
aparentemente selecionada:

-   feche o Serial Monitor;
-   confirme novamente a porta;
-   altere temporariamente a placa e retorne à placa correta, se
    necessário;
-   reabra o sketch;
-   execute novamente o uploader.

------------------------------------------------------------------------

## 18. Primeira inicialização

Após firmware e LittleFS estarem gravados:

``` text
RESET
  │
  ▼
inicializar hardware
  │
  ▼
montar LittleFS
  │
  ▼
carregar NVS
  │
  ▼
inicializar sensores
  │
  ▼
inicializar Wi-Fi
  │
  ▼
servidor Web
  │
  ▼
serviços externos
```

O Serial Monitor é útil para confirmar cada etapa.

------------------------------------------------------------------------

## 19. Provisionamento Wi-Fi

Se nenhuma rede conhecida puder ser utilizada, a estação pode iniciar um
Access Point de configuração.

Exemplo:

``` text
EstacaoAmbiental-Setup
```

Conecte um computador ou celular a essa rede.

O ESP32 passa a atuar temporariamente como ponto de acesso para
configuração.

------------------------------------------------------------------------

## 20. Acesso ao portal de configuração

No modo AP, o endereço típico é:

``` text
http://192.168.4.1
```

A partir dele é possível acessar o portal e selecionar/cadastrar uma
rede Wi-Fi.

A nova configuração deve ser validada antes de substituir uma
configuração persistente funcional.

------------------------------------------------------------------------

## 21. Configuração da estação

A interface permite definir parâmetros como:

-   nome da estação;
-   hostname;
-   rede Wi-Fi;
-   cidade;
-   altitude;
-   demais parâmetros disponíveis.

As configurações persistentes são armazenadas em NVS.

------------------------------------------------------------------------

## 22. Configuração de localização e altitude

A altitude é utilizada no processamento barométrico.

Uma forma de correção da pressão é:

$$
P_0=P\left(1-\frac{0.0065h}{T+0.0065h+273.15}\right)^{-5.257}
$$

onde $h$ representa a altitude.

Por isso, uma altitude incorreta pode afetar a pressão corrigida ao
nível do mar.

O projeto permite obtenção automática associada à localização e também
prevê ajuste manual.

------------------------------------------------------------------------

## 23. Acesso por mDNS

Após conexão à rede local, o endereço padrão é:

``` text
http://estacao-ambiental.local
```

Se o hostname for alterado para:

``` text
minha-estacao
```

o endereço passa conceitualmente a ser:

``` text
http://minha-estacao.local
```

O dispositivo cliente e a rede precisam oferecer suporte a mDNS.

------------------------------------------------------------------------

## 24. Validação dos sensores

Após inicialização, confirme no Serial Monitor e no dashboard:

``` text
BMP180
├── temperatura válida
└── pressão válida

DHT11
└── umidade válida
```

Valores ausentes ou incoerentes devem ser investigados antes da
validação dos serviços externos.

------------------------------------------------------------------------

## 25. Validação do dashboard

Confirme:

-   página carregada;
-   CSS aplicado;
-   JavaScript funcionando;
-   favicon exibido;
-   valores atualizados;
-   gráficos funcionando;
-   eventos apresentados;
-   configurações acessíveis;
-   modo claro/escuro operacional.

Se HTML carregar sem estilo ou comportamento, verifique se todos os
arquivos LittleFS foram enviados.

------------------------------------------------------------------------

## 26. Validação da Open-Meteo

Com Internet disponível, confirme:

``` text
Wi-Fi conectado
      │
      ▼
Internet
      │
      ▼
Open-Meteo
      │
      ▼
dados externos
```

O log local deve permitir identificar conexão, falha e recuperação da
API.

A indisponibilidade da Open-Meteo não deve interromper o processamento
dos sensores.

------------------------------------------------------------------------

## 27. Validação da Cloud

A validação Cloud deve confirmar:

``` text
ESP32
  │
  ▼
POST HTTPS
  │
  ▼
Supabase
  │
  ▼
nova linha em public.leituras
```

Verifique se:

-   registros chegam periodicamente;
-   a estação está identificada;
-   temperatura principal corresponde ao BMP180;
-   campos derivados são preenchidos;
-   timestamps são coerentes;
-   estados e informações externas aparecem quando disponíveis.

Nunca publique no GitHub chaves secretas ou administrativas.

------------------------------------------------------------------------

## 28. Checklist de homologação

Após uma instalação completa:

``` text
[ ] firmware compilou
[ ] tamanho cabe em APP
[ ] upload do firmware concluído
[ ] LittleFS enviado
[ ] BMP180 operacional
[ ] DHT11 operacional
[ ] heartbeat operacional
[ ] Wi-Fi conectado
[ ] dashboard local abre
[ ] favicon carrega
[ ] mDNS funciona
[ ] configuração persiste após reboot
[ ] Open-Meteo conecta
[ ] Supabase recebe telemetria
[ ] eventos são registrados
[ ] reboot não compromete a operação
```

Uma release só deve ser considerada homologada após os itens relevantes
serem validados.

------------------------------------------------------------------------

## 29. Solução de problemas

### Dashboard não abre

Verifique:

-   Wi-Fi;
-   IP;
-   mDNS;
-   servidor HTTP;
-   LittleFS.

Teste também o endereço IP diretamente.

### Página abre sem interface correta

Provável causa:

``` text
LittleFS ausente ou desatualizado
```

Reenvie a pasta `data/`.

### Sensores não apresentam valores

Verifique:

-   alimentação;
-   GND comum;
-   GPIO;
-   SDA/SCL;
-   bibliotecas;
-   inicialização.

### Cloud não recebe dados

Verifique:

-   Internet;
-   endpoint;
-   credencial de cliente;
-   RLS;
-   payload JSON;
-   código HTTP retornado.

### Open-Meteo não responde

Verifique primeiro se o ESP32 possui acesso à Internet. A falha externa
não deve impedir o restante da estação.

------------------------------------------------------------------------

## 30. Atualizações futuras

O processo de instalação poderá evoluir com OTA.

A arquitetura de Flash já possui:

``` text
otadata
app0
app1
```

Uma futura atualização poderá seguir:

``` text
firmware atual
     │
     ▼
baixar nova imagem
     │
     ▼
gravar partição inativa
     │
     ▼
validar
     │
     ▼
reiniciar
```

Até que esse mecanismo seja implementado, atualizações de firmware
continuam sendo realizadas pelo processo de gravação adotado no
desenvolvimento.

------------------------------------------------------------------------

## 31. Resumo

A instalação completa exige preservar quatro elementos:

``` text
HARDWARE
   +
FIRMWARE
   +
PARTICIONAMENTO
   +
LITTLEFS
```

O fluxo recomendado é:

``` text
preparar hardware
      │
      ▼
configurar Arduino IDE
      │
      ▼
selecionar Custom
      │
      ▼
compilar
      │
      ▼
gravar firmware
      │
      ▼
gravar LittleFS
      │
      ▼
provisionar Wi-Fi
      │
      ▼
configurar estação
      │
      ▼
validar Edge
      │
      ▼
validar serviços externos
```

Esse procedimento torna a implantação reproduzível e reduz a dependência
do conhecimento informal acumulado durante o desenvolvimento.
