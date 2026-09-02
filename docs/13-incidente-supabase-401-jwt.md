# Incidente Supabase REST --- HTTP 401 / PGRST303

**Projeto:** Estação Ambiental ESP32 --- Computação de Borda\
**Data do incidente:** 02/09/2026\
**Componente afetado:** camada Cloud/Web --- comunicação Vercel →
Supabase REST/PostgREST\
**Estado final:** serviço restabelecido

## Índice

1.  [Objetivo deste documento](#1-objetivo-deste-documento)
2.  [Contexto da arquitetura](#2-contexto-da-arquitetura)
3.  [Resumo do incidente](#3-resumo-do-incidente)
4.  [Sintomas observados](#4-sintomas-observados)
5.  [Impacto sobre a estação](#5-impacto-sobre-a-estação)
6.  [Evidências coletadas](#6-evidências-coletadas)
7.  [Processo de diagnóstico](#7-processo-de-diagnóstico)
8.  [Hipóteses e testes realizados](#8-hipóteses-e-testes-realizados)
9.  [Problema secundário no
    `_supabase.js`](#9-problema-secundário-no-_supabasejs)
10. [Recuperação do serviço](#10-recuperação-do-serviço)
11. [Causa provável e limites do
    diagnóstico](#11-causa-provável-e-limites-do-diagnóstico)
12. [Estado final homologado](#12-estado-final-homologado)
13. [Lições aprendidas](#13-lições-aprendidas)
14. [Relação com Computação de
    Borda](#14-relação-com-computação-de-borda)
15. [Recomendações para incidentes
    futuros](#15-recomendações-para-incidentes-futuros)

------------------------------------------------------------------------

## 1. Objetivo deste documento

Este documento registra um incidente real ocorrido na infraestrutura
Cloud da Estação Ambiental ESP32, descrevendo os sintomas, as evidências
observadas, o processo de diagnóstico, as tentativas de correção e o
restabelecimento do serviço.

O objetivo não é apenas registrar uma falha operacional. O episódio
constitui também um estudo de caso sobre **resiliência em uma
arquitetura Edge--Cloud**, pois a indisponibilidade da camada Web não
interrompeu a aquisição e o processamento local realizados pelo ESP32.

------------------------------------------------------------------------

## 2. Contexto da arquitetura

A estação segue uma arquitetura em camadas:

``` text
Sensores ambientais
        │
        ▼
ESP32 / Edge
        │
        ├── processamento local
        ├── dashboard local
        ├── estados e alertas
        └── telemetria
        │
        ▼
Supabase
        │
        ├── armazenamento
        └── REST / RPC
        │
        ▼
Vercel Serverless API
        │
        ├── /api/agora
        ├── /api/historico
        └── /api/resumo
        │
        ▼
Dashboard Web
```

A decisão arquitetural adotada no projeto é:

> **Dashboard local = operacional e resiliente.**\
> **Dashboard Web = histórico e analítico.**

Em termos mais gerais:

> **Edge primeiro; Cloud como extensão.**

------------------------------------------------------------------------

## 3. Resumo do incidente

Em 02/09/2026, o dashboard Web passou a indicar a estação como offline e
deixou de apresentar as leituras ambientais.

Inicialmente, isso poderia indicar falha do ESP32, perda de
conectividade, interrupção do envio ao Supabase ou problema no frontend.

A investigação demonstrou, entretanto, uma falha parcial:

``` text
ESP32 → Supabase INSERT        OK
Supabase → armazenamento       OK
Vercel → Supabase REST/RPC     FALHA
Dashboard Web                  FALHA
```

As requisições de leitura realizadas pela Vercel recebiam:

``` text
HTTP 401 Unauthorized
PGRST303
JWT issued at future
```

Enquanto isso, o ESP32 continuava enviando aproximadamente uma nova
leitura por minuto para a tabela `public.leituras`.

------------------------------------------------------------------------

## 4. Sintomas observados

O principal sintoma visível foi o dashboard remoto indicar:

``` text
estação offline
```

A rota:

``` text
/api/agora
```

passou a responder com erro da aplicação:

``` json
{
  "erro": "supabase_erro",
  "mensagem": "Não foi possível consultar o estado atual da estação."
}
```

Os logs da Vercel mostravam que o erro de aplicação era consequência de
uma resposta HTTP 401 do Supabase.

O detalhe observado foi:

``` text
PGRST303
JWT issued at future
```

As três rotas Cloud apresentaram o mesmo comportamento:

``` text
/api/agora
/api/historico
/api/resumo
```

------------------------------------------------------------------------

## 5. Impacto sobre a estação

O incidente **não interrompeu a operação do Edge**.

Durante a indisponibilidade do dashboard Web:

-   o ESP32 permaneceu ativo;
-   os sensores continuaram sendo lidos;
-   os cálculos e estados ambientais locais continuaram funcionando;
-   o dashboard local permaneceu disponível;
-   eventos locais continuaram sendo registrados;
-   a conexão com a Internet continuou operacional;
-   o ESP32 continuou enviando telemetria ao Supabase;
-   as novas linhas continuaram sendo armazenadas na tabela `leituras`.

A falha ocorreu na camada de **consulta Cloud/Web**, e não na aquisição.

Representação simplificada:

``` text
                    continuou operacional
                           │
                           ▼
Sensores ──► ESP32 ──► Supabase
   OK         OK          OK
                          │
                          X  HTTP 401
                          │
                       Vercel
                          │
                          X
                          │
                    Dashboard Web
```

------------------------------------------------------------------------

## 6. Evidências coletadas

### 6.1 ESP32 continuava enviando dados

O Table Editor e o SQL Editor do Supabase mostraram novas linhas sendo
inseridas aproximadamente a cada minuto.

Exemplo observado durante o incidente:

``` text
POST /rest/v1/leituras → HTTP 201 Created
```

Isso demonstrou que:

``` text
ESP32 → Internet → Supabase → PostgreSQL
```

continuava funcional.

### 6.2 Banco de dados operacional

Uma consulta executada diretamente no SQL Editor:

``` sql
select *
from public.leituras
order by created_at desc
limit 5;
```

retornou as leituras recentes normalmente.

Portanto, não havia evidência de perda ou indisponibilidade do banco
PostgreSQL.

### 6.3 Vercel alcançava o Supabase

Os logs da Vercel mostravam:

``` text
Falha ao consultar Supabase: HTTP 401
```

Portanto, a comunicação de rede existia. O Supabase recebia a
requisição, mas recusava a autenticação.

### 6.4 Logs do próprio Supabase

Os logs do Supabase confirmaram simultaneamente:

``` text
POST /rest/v1/leituras              → 201
GET  /rest/v1/leituras              → 401
POST /rest/v1/rpc/historico_...     → 401
POST /rest/v1/rpc/resumo_...        → 401
GET  /auth/v1/health                → 200
HEAD /rest-admin/v1/ready           → 200
```

Essa evidência foi particularmente importante para localizar a falha na
camada REST/autenticação.

------------------------------------------------------------------------

## 7. Processo de diagnóstico

O diagnóstico foi realizado progressivamente, evitando alterar vários
componentes ao mesmo tempo.

### Etapa 1 --- Verificação do Edge

O dashboard local mostrou que o ESP32 estava ativo e executando
normalmente.

### Etapa 2 --- Verificação da persistência

O Supabase mostrou novas linhas sendo gravadas.

Resultado:

``` text
ESP32 → Supabase = OK
```

### Etapa 3 --- Teste da API Web

A rota `/api/agora` retornou erro.

### Etapa 4 --- Análise dos logs Vercel

Os logs revelaram:

``` text
HTTP 401
PGRST303
JWT issued at future
```

### Etapa 5 --- Verificação das variáveis de ambiente

Foram confirmadas na Vercel:

``` text
SUPABASE_URL
ESTACAO_ID
SUPABASE_SERVICE_ROLE_KEY
```

### Etapa 6 --- Substituição da Secret API Key

Uma nova `sb_secret_...` foi criada no Supabase, configurada
exclusivamente no backend da Vercel e seguida de novo deployment.

Resultado:

``` text
HTTP 401 permaneceu
```

A troca da chave, isoladamente, portanto, **não solucionou o
incidente**.

### Etapa 7 --- Reinicialização do projeto Supabase

O projeto Supabase foi reiniciado.

Posteriormente foi necessário resolver um segundo problema independente
no código implantado na Vercel.

Após a correção desse segundo problema, a comunicação REST voltou a
funcionar.

------------------------------------------------------------------------

## 8. Hipóteses e testes realizados

  -----------------------------------------------------------------------
  Hipótese                Teste/Evidência         Resultado
  ----------------------- ----------------------- -----------------------
  ESP32 offline           Dashboard local e novas Descartada
                          leituras                

  Internet do ESP32       POSTs 201 no Supabase   Descartada
  indisponível                                    

  Banco indisponível      SQL Editor e novas      Descartada
                          linhas                  

  Vercel sem alcançar     Supabase retornava 401  Descartada
  Supabase                                        

  Secret Key              Nova Secret Key testada Não resolveu
  revogada/incorreta                              

  Problema em RLS/SELECT  Erro específico         Não explicou
                          PGRST303/JWT            isoladamente o
                                                  incidente

  Falha na camada         Logs Vercel + Supabase  Fortemente sustentada
  REST/JWT/PostgREST                              

  Estado interno do       Restart seguido de      Hipótese relevante, não
  projeto Supabase        recuperação posterior   conclusiva
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 9. Problema secundário no `_supabase.js`

Durante o processo de diagnóstico surgiu um segundo erro, independente
do incidente original:

``` text
500 INTERNAL_SERVER_ERROR
FUNCTION_INVOCATION_FAILED
SyntaxError: Illegal return statement
```

As três rotas passaram a apresentar esse erro.

A inspeção do **Source do deployment efetivamente executado pela
Vercel** revelou que `_supabase.js` continha um bloco duplicado fora da
função `supabaseFetch()`.

Havia um segundo:

``` js
return resposta;
```

fora de qualquer função, produzindo exatamente:

``` text
SyntaxError: Illegal return statement
```

Também havia sido introduzido novamente:

``` js
Authorization: `Bearer ${serviceRole}`
```

A versão homologada foi restaurada para utilizar a nova Secret API Key
apenas por meio do header `apikey`:

``` js
headers: {
  apikey: serviceRole,
  Accept: "application/json",
  ...(options.body ? { "Content-Type": "application/json" } : {}),
  ...(options.headers || {})
}
```

O bloco duplicado foi removido.

Este episódio reforçou a importância de distinguir:

1.  o **incidente original Supabase/PostgREST**, e
2.  o **erro sintático introduzido durante o troubleshooting**.

------------------------------------------------------------------------

## 10. Recuperação do serviço

Após:

1.  reinicialização do projeto Supabase;
2.  identificação do problema secundário no deployment;
3.  restauração do `_supabase.js` correto;
4.  novo deployment da aplicação;

a rota:

``` text
/api/agora
```

voltou a responder normalmente.

O JSON voltou a apresentar dados atuais da estação, incluindo:

``` text
status: online
temperatura
temperatura_media15
umidade
pressao_mar
pressao_local
pressao_media15
pressao_media60
tendencia_pressao_hora
ponto_orvalho
estado_geral
rssi
altitude
dados externos Open-Meteo
```

O dashboard Web voltou a indicar:

``` text
estação online
```

As rotas de histórico e resumo também voltaram a integrar a arquitetura
operacional.

------------------------------------------------------------------------

## 11. Causa provável e limites do diagnóstico

É importante separar **evidência** de **inferência**.

### Fatos comprovados

Foram efetivamente observados:

``` text
ESP32 → Supabase POST       → 201
Vercel → Supabase GET/RPC   → 401
PGRST303                    → JWT issued at future
```

Também foi comprovado que:

-   o banco continuava recebendo dados;
-   a troca da Secret API Key não resolveu o 401;
-   o projeto Supabase foi reiniciado;
-   houve posteriormente um erro sintático independente no
    `_supabase.js`;
-   esse erro foi identificado e corrigido;
-   após essas ações, o serviço REST voltou a responder;
-   o dashboard voltou ao estado online.

### Inferência

A reinicialização do projeto Supabase é uma ação **fortemente associada
temporalmente** ao restabelecimento do incidente original, especialmente
porque a troca de credencial já havia falhado anteriormente.

Entretanto, não é possível estabelecer causalidade absoluta apenas com
as evidências disponíveis, pois após o restart também foi necessário
corrigir um problema independente no código implantado na Vercel.

Assim, a formulação tecnicamente prudente é:

> O incidente original manifestou-se como uma falha de autenticação na
> camada Supabase REST/PostgREST, com HTTP 401 e
> `PGRST303: JWT issued at future`. A troca da Secret API Key não
> solucionou o problema. Após a reinicialização do projeto Supabase e a
> posterior restauração do código correto da Vercel, a comunicação foi
> restabelecida. As evidências sugerem que o restart teve papel
> relevante na recuperação, mas não permitem atribuir causalidade
> exclusiva a essa ação.

------------------------------------------------------------------------

## 12. Estado final homologado

Após a recuperação:

``` text
ESP32 / Edge                 OK
Sensores                     OK
Dashboard local              OK
Supabase INSERT              OK
Banco PostgreSQL             OK
Supabase REST SELECT         OK
Supabase RPC                 OK
Vercel Serverless API        OK
/api/agora                   OK
/api/historico               OK
/api/resumo                  OK
Dashboard Web                ONLINE
```

Configuração homologada do backend:

``` text
Secret API Key:
- armazenada somente na Vercel
- não exposta no frontend
- não armazenada no firmware
- não armazenada no GitHub
```

O `_supabase.js` utiliza a Secret API Key no header:

``` text
apikey
```

------------------------------------------------------------------------

## 13. Lições aprendidas

### 13.1 Um dashboard offline não significa necessariamente Edge offline

O primeiro diagnóstico deve separar:

``` text
aquisição
processamento
persistência
consulta
apresentação
```

Cada camada pode falhar independentemente.

### 13.2 Os logs de múltiplas camadas são fundamentais

A combinação de:

-   dashboard local;
-   Table Editor;
-   SQL Editor;
-   logs do Supabase;
-   logs da Vercel;
-   endpoint `/api/agora`;

permitiu localizar progressivamente a falha.

### 13.3 Não alterar vários componentes simultaneamente

Trocas de chave, alterações de código, restart e redeploy devem ser
tratados como experimentos distintos sempre que possível.

Isso melhora a capacidade de atribuir causa e efeito.

### 13.4 O código do deployment deve ser auditável

O conteúdo local ou do repositório pode não ser suficiente para explicar
um erro.

Neste incidente, a inspeção de:

``` text
Vercel → Deployment → Source
```

foi decisiva para descobrir que o `_supabase.js` efetivamente implantado
continha código diferente do arquivo considerado correto.

### 13.5 Credenciais devem permanecer segregadas

Secret API Keys devem permanecer exclusivamente em ambiente server-side
protegido.

A arquitetura adotada continua sendo:

``` text
Browser
   │
   ▼
Vercel API
   │
   ▼
Supabase
```

e não:

``` text
Browser ──► Supabase usando Secret API Key
```

------------------------------------------------------------------------

## 14. Relação com Computação de Borda

Este incidente constitui uma demonstração prática de uma das principais
vantagens da Computação de Borda.

Durante a falha Cloud:

``` text
Sensores
   │
   ▼
ESP32
   ├── aquisição             OK
   ├── processamento         OK
   ├── estados ambientais    OK
   ├── dashboard local       OK
   └── envio de telemetria   OK
```

A indisponibilidade ocorreu acima da camada Edge:

``` text
Supabase REST/RPC
       │
       X
       │
     Vercel
       │
       X
       │
Dashboard Web
```

Portanto, a estação continuou cumprindo sua função operacional mesmo com
indisponibilidade temporária da camada de consulta remota.

O episódio valida experimentalmente a decisão arquitetural:

> **Dashboard local = operacional e resiliente.**\
> **Dashboard Web = histórico e analítico.**

E reforça o princípio:

> **Edge primeiro; Cloud como extensão.**

------------------------------------------------------------------------

## 15. Recomendações para incidentes futuros

Em uma nova indisponibilidade do dashboard Web, recomenda-se seguir esta
ordem:

``` text
1. Verificar dashboard local / ESP32
              │
              ▼
2. Verificar novas linhas no Supabase
              │
              ▼
3. Testar /api/agora
              │
              ▼
4. Consultar logs da Vercel
              │
              ▼
5. Consultar logs do Supabase
              │
              ▼
6. Classificar a camada da falha
              │
              ▼
7. Alterar apenas um componente por vez
              │
              ▼
8. Validar novamente ponta a ponta
```

Também é recomendável registrar:

-   horário inicial do incidente;
-   última leitura disponível;
-   códigos HTTP;
-   mensagens de erro;
-   deployments envolvidos;
-   alterações realizadas;
-   resultado de cada teste;
-   horário de recuperação.

Esse procedimento transforma troubleshooting em um processo experimental
reproduzível e melhora progressivamente a maturidade operacional da
plataforma.

------------------------------------------------------------------------

**Documento:** `13-incidente-supabase-401-jwt.md`\
**Projeto:** Estação Ambiental ESP32 --- Computação de Borda\
**Situação:** incidente encerrado e serviço restabelecido.
