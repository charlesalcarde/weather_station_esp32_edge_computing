# Particionamento da Memória Flash da Estação Ambiental ESP32

Este documento descreve a organização da memória Flash da **Estação
Ambiental ESP32**, a motivação para adoção de uma tabela de partições
personalizada, a preservação de OTA, NVS e LittleFS e os cuidados
necessários durante atualizações do projeto.

> Documento referente ao particionamento homologado na fase **v3.4-RC1**
> do projeto.

------------------------------------------------------------------------

## Índice

-   [1. Visão geral](#1-visão-geral)
-   [2. Motivação para o particionamento
    personalizado](#2-motivação-para-o-particionamento-personalizado)
-   [3. Memória Flash física](#3-memória-flash-física)
-   [4. O que é uma tabela de
    partições](#4-o-que-é-uma-tabela-de-partições)
-   [5. Layout homologado](#5-layout-homologado)
-   [6. Arquivo partitions.csv](#6-arquivo-partitionscsv)
-   [7. Cálculo dos tamanhos](#7-cálculo-dos-tamanhos)
    -   [7.1 NVS](#71-nvs)
    -   [7.2 OTA Data](#72-ota-data)
    -   [7.3 APP0 e APP1](#73-app0-e-app1)
    -   [7.4 Filesystem](#74-filesystem)
    -   [7.5 Verificação do total](#75-verificação-do-total)
-   [8. Mapa da Flash](#8-mapa-da-flash)
-   [9. APP0 e APP1](#9-app0-e-app1)
-   [10. Preservação de OTA](#10-preservação-de-ota)
-   [11. NVS](#11-nvs)
-   [12. LittleFS e a partição spiffs](#12-littlefs-e-a-partição-spiffs)
-   [13. Por que o nome spiffs aparece no
    CSV](#13-por-que-o-nome-spiffs-aparece-no-csv)
-   [14. Capacidade do LittleFS](#14-capacidade-do-littlefs)
-   [15. Uso atual da partição APP](#15-uso-atual-da-partição-app)
-   [16. O percentual exibido pelo Arduino
    IDE](#16-o-percentual-exibido-pelo-arduino-ide)
-   [17. Upload do firmware](#17-upload-do-firmware)
-   [18. Upload do LittleFS](#18-upload-do-littlefs)
-   [19. Alteração da tabela de
    partições](#19-alteração-da-tabela-de-partições)
-   [20. Riscos e cuidados](#20-riscos-e-cuidados)
-   [21. Estrutura obrigatória do
    projeto](#21-estrutura-obrigatória-do-projeto)
-   [22. Monitoramento de crescimento](#22-monitoramento-de-crescimento)
-   [23. Espaço para evolução](#23-espaço-para-evolução)
-   [24. Resumo](#24-resumo)

------------------------------------------------------------------------

## 1. Visão geral

O ESP32 utilizado na estação possui **4 MB de memória Flash física**.

Essa memória precisa armazenar diferentes tipos de informação:

``` text
Flash
│
├── configurações persistentes
├── metadados OTA
├── firmware
├── segunda imagem de firmware
└── arquivos do dashboard
```

A divisão da Flash é definida por uma **tabela de partições**.

------------------------------------------------------------------------

## 2. Motivação para o particionamento personalizado

Durante a evolução do firmware, o tamanho do binário aumentou
significativamente.

Na configuração padrão anteriormente utilizada, o firmware chegou a
aproximadamente:

``` text
95% da partição APP disponível
```

Isso indicava pouca margem para novas funcionalidades.

O problema não era falta de Flash física, mas a forma como os 4 MB
estavam divididos.

A solução foi criar um layout personalizado que:

-   aumentasse o espaço disponível para cada imagem do firmware;
-   preservasse duas partições de aplicação;
-   preservasse OTA;
-   preservasse NVS;
-   mantivesse espaço suficiente para LittleFS.

------------------------------------------------------------------------

## 3. Memória Flash física

A capacidade física é:

$$
4\ \mathrm{MiB}=4\times1024\times1024\ \mathrm{bytes}
$$

portanto:

$$
4\ \mathrm{MiB}=4194304\ \mathrm{bytes}
$$

Em hexadecimal:

$$
4194304=0x400000
$$

Assim, o espaço de endereçamento considerado termina em:

``` text
0x400000
```

------------------------------------------------------------------------

## 4. O que é uma tabela de partições

A tabela informa ao ESP32 como regiões da Flash serão utilizadas.

Cada entrada define elementos como:

-   nome;
-   tipo;
-   subtipo;
-   offset;
-   tamanho;
-   flags.

Conceitualmente:

``` text
Flash física
│
├── região A → NVS
├── região B → OTA Data
├── região C → APP0
├── região D → APP1
└── região E → filesystem
```

As regiões não podem se sobrepor.

------------------------------------------------------------------------

## 5. Layout homologado

O layout adotado é:

  Partição           Offset   Tamanho hexadecimal     Tamanho
  ------------ ------------ --------------------- -----------
  NVS              `0x9000`              `0x5000`      20 KiB
  OTA Data         `0xE000`              `0x2000`       8 KiB
  APP0            `0x10000`            `0x1A0000`   1.625 MiB
  APP1           `0x1B0000`            `0x1A0000`   1.625 MiB
  Filesystem     `0x350000`            `0x0B0000`     704 KiB

O final da última partição coincide exatamente com o limite da Flash de
4 MB.

------------------------------------------------------------------------

## 6. Arquivo partitions.csv

O arquivo homologado é:

``` csv
# Name,   Type, SubType, Offset,   Size,     Flags
nvs,      data, nvs,     0x9000,   0x5000,
otadata,  data, ota,     0xE000,   0x2000,
app0,     app,  ota_0,   0x10000,  0x1A0000,
app1,     app,  ota_1,   0x1B0000, 0x1A0000,
spiffs,   data, spiffs,  0x350000, 0x0B0000,
```

Esse arquivo faz parte da configuração do firmware e deve ser versionado
no repositório.

------------------------------------------------------------------------

## 7. Cálculo dos tamanhos

Os tamanhos declarados no CSV estão em hexadecimal.

### 7.1 NVS

A NVS possui:

$$
0x5000=20480\ \mathrm{bytes}
$$

Como:

$$
1\ \mathrm{KiB}=1024\ \mathrm{bytes}
$$

temos:

$$
\frac{20480}{1024}=20\ \mathrm{KiB}
$$

### 7.2 OTA Data

A partição OTA Data possui:

$$
0x2000=8192\ \mathrm{bytes}
$$

portanto:

$$
\frac{8192}{1024}=8\ \mathrm{KiB}
$$

### 7.3 APP0 e APP1

Cada partição de aplicação possui:

$$
0x1A0000=1703936\ \mathrm{bytes}
$$

Convertendo para MiB:

$$
\frac{1703936}{1024^2}=1.625\ \mathrm{MiB}
$$

Logo:

$$
APP0=APP1=1.625\ \mathrm{MiB}
$$

As duas partições de aplicação juntas ocupam:

$$
2\times1703936=3407872\ \mathrm{bytes}
$$

ou:

$$
3.25\ \mathrm{MiB}
$$

### 7.4 Filesystem

A partição reservada ao filesystem possui:

$$
0x0B0000=720896\ \mathrm{bytes}
$$

Convertendo:

$$
\frac{720896}{1024}=704\ \mathrm{KiB}
$$

### 7.5 Verificação do total

A última partição começa em:

``` text
0x350000
```

e possui tamanho:

``` text
0x0B0000
```

Portanto:

$$
0x350000+0x0B0000=0x400000
$$

que corresponde exatamente a:

$$
4\ \mathrm{MiB}
$$

Isso confirma que o layout termina no limite físico previsto da Flash.

------------------------------------------------------------------------

## 8. Mapa da Flash

Representação simplificada:

``` text
0x000000
   │
   │ bootloader / tabela / áreas reservadas
   │
0x009000 ┌─────────────────────────────┐
         │ NVS — 20 KiB                │
0x00E000 ├─────────────────────────────┤
         │ OTA Data — 8 KiB            │
0x010000 ├─────────────────────────────┤
         │ APP0 — 1.625 MiB            │
0x1B0000 ├─────────────────────────────┤
         │ APP1 — 1.625 MiB            │
0x350000 ├─────────────────────────────┤
         │ LittleFS — 704 KiB          │
0x400000 └─────────────────────────────┘
```

------------------------------------------------------------------------

## 9. APP0 e APP1

A existência de duas partições de aplicação é essencial para OTA.

Em operação normal, uma partição contém o firmware ativo.

Durante uma futura atualização OTA, a nova imagem pode ser gravada na
outra partição.

Conceitualmente:

``` text
APP0
└── firmware atual

APP1
└── espaço para nova versão
```

Após validação e reinicialização, a partição selecionada pode mudar.

------------------------------------------------------------------------

## 10. Preservação de OTA

A tabela inclui:

``` text
otadata
app0
app1
```

portanto a estrutura necessária para futuras atualizações OTA foi
preservada.

Isso não significa que o mecanismo de atualização OTA já esteja
implementado no firmware.

Significa que o **layout de memória está preparado** para essa evolução.

------------------------------------------------------------------------

## 11. NVS

A partição NVS armazena dados persistentes.

No projeto, ela pode conter:

-   redes Wi-Fi;
-   hostname;
-   identificação;
-   localização;
-   altitude;
-   configurações operacionais.

Alterações na tabela de partições exigem cuidado porque mudar offsets
pode afetar dados persistentes existentes.

------------------------------------------------------------------------

## 12. LittleFS e a partição spiffs

O dashboard é armazenado utilizando **LittleFS**.

Os arquivos incluem:

``` text
data/
├── index.html
├── style.css
├── app.js
└── favicon.png
```

No entanto, a entrada da tabela é:

``` csv
spiffs, data, spiffs, 0x350000, 0x0B0000,
```

Isso é intencional e compatível com a configuração utilizada pelo
Arduino-ESP32.

------------------------------------------------------------------------

## 13. Por que o nome spiffs aparece no CSV

Apesar de o firmware utilizar LittleFS, a biblioteca pode procurar por
padrão uma partição identificada pelo label:

``` text
spiffs
```

Por isso, utilizar:

``` csv
spiffs, data, spiffs, ...
```

mantém compatibilidade com a montagem realizada por `LittleFS.begin()`
na configuração atual.

O nome da partição não significa que o firmware esteja utilizando a
antiga biblioteca SPIFFS para manipular os arquivos.

A distinção é:

``` text
partição na tabela → label/subtipo compatível "spiffs"

API usada no firmware → LittleFS
```

------------------------------------------------------------------------

## 14. Capacidade do LittleFS

A capacidade reservada é:

$$
S_{\mathrm{LittleFS}}=704\ \mathrm{KiB}
$$

Se os arquivos armazenados ocuparem (S\_{`\mathrm{arquivos}`{=tex}}), a
utilização percentual aproximada é:

$$
U=\frac{S_{\mathrm{arquivos}}}{S_{\mathrm{LittleFS}}}\times100
$$

Por exemplo, para aproximadamente 112 KiB de arquivos:

$$
U=\frac{112}{704}\times100
$$

$$
U\approx15.9\%
$$

Portanto, há ampla margem para evolução do dashboard.

------------------------------------------------------------------------

## 15. Uso atual da partição APP

Na homologação do particionamento, o firmware possuía aproximadamente:

$$
S_{\mathrm{firmware}}=1252016\ \mathrm{bytes}
$$

A capacidade de cada APP é:

$$
S_{\mathrm{APP}}=1703936\ \mathrm{bytes}
$$

A utilização real é:

$$
U_{\mathrm{APP}}=
\frac{1252016}{1703936}\times100
$$

resultando aproximadamente em:

$$
U_{\mathrm{APP}}\approx73.5\%
$$

O espaço restante é:

$$
S_{\mathrm{livre}}=1703936-1252016
$$

$$
S_{\mathrm{livre}}=451920\ \mathrm{bytes}
$$

ou aproximadamente:

$$
441\ \mathrm{KiB}
$$

Essa é a margem real relevante para o crescimento do firmware.

------------------------------------------------------------------------

## 16. O percentual exibido pelo Arduino IDE

No modo de partição **Custom**, o Arduino IDE pode apresentar uma
mensagem indicando um máximo genérico de:

``` text
16777216 bytes
```

ou:

$$
16\ \mathrm{MiB}
$$

Isso **não significa que a placa passou a possuir 16 MB de Flash
física**.

A placa continua com:

$$
4\ \mathrm{MiB}
$$

O valor de 16 MB é uma referência genérica da configuração `Custom` da
plataforma.

Para este projeto, o limite real de cada imagem de aplicação é definido
pelo `partitions.csv`:

$$
S_{\mathrm{APP,max}}=1703936\ \mathrm{bytes}
$$

Por isso, o percentual apresentado automaticamente pelo IDE no modo
Custom não deve ser utilizado isoladamente para avaliar a ocupação.

------------------------------------------------------------------------

## 17. Upload do firmware

O firmware é gravado na região de aplicação.

O processo de upload utiliza a tabela personalizada quando a opção
`Custom` está selecionada e o `partitions.csv` está presente no
diretório correto do sketch.

A compilação e o upload devem ser interrompidos caso o binário
ultrapasse a capacidade real da partição APP.

------------------------------------------------------------------------

## 18. Upload do LittleFS

Os arquivos da pasta `data/` são enviados separadamente.

O uploader reconheceu na configuração homologada:

``` text
Start: 0x350000
End:   0x400000
```

O tamanho da imagem do filesystem corresponde a:

$$
0x400000-0x350000=0x0B0000
$$

ou:

$$
704\ \mathrm{KiB}
$$

Depois de uma alteração na tabela de partições, é recomendável reenviar
o LittleFS antes de validar completamente o dashboard.

------------------------------------------------------------------------

## 19. Alteração da tabela de partições

Modificar offsets ou tamanhos altera a interpretação física da Flash.

Por exemplo:

``` text
layout antigo
APP | APP | filesystem

layout novo
APP maior | APP maior | filesystem menor
```

Os bytes fisicamente existentes não são automaticamente reorganizados.

Por isso, após mudança do layout, firmware e filesystem devem ser
tratados como componentes que podem precisar ser gravados novamente.

------------------------------------------------------------------------

## 20. Riscos e cuidados

Os principais riscos de uma alteração incorreta são:

-   sobreposição de partições;
-   firmware maior que APP;
-   filesystem apontando para offset incorreto;
-   perda de arquivos;
-   perda de configurações NVS;
-   impossibilidade de OTA;
-   boot incorreto.

A soma dos offsets e tamanhos deve sempre respeitar o limite físico.

Para uma partição iniciada em (O) e com tamanho (S):

$$
E=O+S
$$

onde (E) é o endereço final.

Para partições consecutivas, deve ser garantido que a próxima não comece
antes do final da anterior.

------------------------------------------------------------------------

## 21. Estrutura obrigatória do projeto

A tabela deve acompanhar o firmware no repositório:

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

Distribuir apenas o `.ino` não representa completamente a configuração
executável da estação.

------------------------------------------------------------------------

## 22. Monitoramento de crescimento

O crescimento do firmware deve ser acompanhado em relação à capacidade
real da APP.

A utilização é:

$$
U_{\mathrm{APP}}=
\frac{S_{\mathrm{binário}}}{S_{\mathrm{APP}}}\times100
$$

e a margem disponível:

$$
M=S_{\mathrm{APP}}-S_{\mathrm{binário}}
$$

Uma margem muito pequena pode dificultar a inclusão de novas bibliotecas
e funcionalidades.

O mesmo princípio vale para o filesystem:

$$
M_{\mathrm{FS}}=S_{\mathrm{FS}}-S_{\mathrm{arquivos}}
$$

------------------------------------------------------------------------

## 23. Espaço para evolução

O layout atual equilibra três objetivos:

``` text
firmware maior
      +
OTA preservado
      +
dashboard com espaço suficiente
```

Isso permite continuar evoluindo recursos como:

-   modularização;
-   fila resiliente;
-   OTA;
-   novas APIs;
-   TinyML;
-   novas páginas e recursos do dashboard.

Qualquer crescimento significativo deve ser acompanhado por nova
avaliação de Flash e RAM.

------------------------------------------------------------------------

## 24. Resumo

O particionamento homologado pode ser resumido por:

``` text
Flash física: 4 MiB

NVS       20 KiB
OTA Data   8 KiB
APP0       1.625 MiB
APP1       1.625 MiB
LittleFS   704 KiB
```

A customização resolveu a limitação da partição APP padrão sem eliminar
OTA nem o filesystem.

O arquivo `partitions.csv` deve, portanto, ser tratado como **parte
integrante da arquitetura da Estação Ambiental ESP32**, e não apenas
como uma configuração auxiliar de compilação.
