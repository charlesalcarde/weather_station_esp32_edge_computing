# Dashboard Web e camada Cloud — Estação Ambiental ESP32

> **Referência:** código da branch `main` inspecionado em 13/11/2026. Este documento descreve o código versionado; a confirmação de implantação depende da versão efetivamente publicada na Vercel.

## Índice

- [1. Objetivo e limites](#1-objetivo-e-limites)
- [2. Arquitetura e responsabilidades](#2-arquitetura-e-responsabilidades)
- [3. Endpoints versionados](#3-endpoints-versionados)
- [4. Interface e horizontes temporais](#4-interface-e-horizontes-temporais)
- [5. Parecer ambiental com IA](#5-parecer-ambiental-com-ia)
- [6. Laboratório M5](#6-laboratório-m5)
- [7. Limitações e verificações](#7-limitações-e-verificações)
- [8. Referências internas](#8-referências-internas)

## 1. Objetivo e limites

A camada Web permite consultar telemetria da estação, comparar medidas locais com uma referência meteorológica externa, explorar a qualidade temporal e simular políticas de seleção de transmissões. **Ela não substitui o processamento Edge** e não constitui prova de que uma política simulada esteja ativa no firmware.

## 2. Arquitetura e responsabilidades

```text
ESP32 (aquisição e processamento Edge)
    └── telemetria HTTP(S) → Supabase
                                  └── APIs serverless Vercel → navegador
                                  └── análise e parecer com IA sob demanda
```

- **Estação física:** fonte das medidas locais, com localização e altitude próprias.
- **Referência externa:** dados meteorológicos para comparação contextual; mudar a referência não deve alterar os cálculos físicos da estação.
- **Campanha de medição:** contexto temporal e de instalação que deve ser preservado quando houver mudança física da estação.
- **Supabase:** armazenamento e consulta das leituras.
- **Vercel:** APIs, interface e processamento analítico do dashboard.

## 3. Endpoints versionados

| Endpoint | Método | Finalidade |
| --- | --- | --- |
| `/api/agora` | GET | Última telemetria e estados disponíveis |
| `/api/historico` | GET | Série histórica com resolução adequada ao horizonte |
| `/api/resumo` | GET | Estatísticas e indicadores do período |
| `/api/m5-serie` | GET | Série bruta paginada para a simulação M5 |
| `/api/parecer` | POST | Parecer gerado sob demanda a partir de evidências estruturadas |

O arquivo `web/api/_supabase.js` concentra a configuração e os acessos compartilhados ao Supabase. As credenciais `SUPABASE_SERVICE_ROLE_KEY` e `GEMINI_API_KEY` devem permanecer exclusivamente no servidor; não as inserir em JavaScript enviado ao navegador, documentação, logs ou exemplos públicos.

## 4. Interface e horizontes temporais

A interface versionada contempla horizonte de **60 minutos**, **24 horas**, **7 dias**, **30 dias** e seleção personalizada. A leitura atual é consultada em cadência própria; o histórico possui atualização periódica ajustada ao horizonte. A apresentação separa informações de operação Edge e análises Cloud, sem repetir os mesmos indicadores em múltiplos painéis.

A comparação local × referência externa é **exploratória**. Correlação, defasagem e atenuação devem ser interpretadas com cautela diante de lacunas, agregação, sazonalidade, ventilação e características do ambiente de instalação. Associação estatística não estabelece causalidade.

## 5. Parecer ambiental com IA

A rota `web/api/parecer.js` recebe evidências no esquema `parecer-evidencias-v2`, valida estrutura e tamanho do pacote e consulta o serviço Gemini no servidor. O modelo padrão no código inspecionado é `gemini-2.5-flash`, configurável por `GEMINI_MODEL`. A resposta utiliza o esquema `parecer-ambiental-v1`.

**Limite de segurança conhecido:** o controle de frequência em memória por instância é apenas uma proteção básica e não equivale a rate limiting distribuído. Além disso, as evidências são fornecidas pelo cliente; a validação estrutural não prova sua origem. Antes de expor a rota publicamente em escala, avaliar autenticação ou mecanismo equivalente, cotas distribuídas e validação de procedência. Não declarar essas proteções como implementadas sem evidência no código.

O parecer é uma interpretação automatizada de evidências, não uma medição adicional nem uma conclusão causal.

## 6. Laboratório M5

A interface solicita a série **bruta** via `/api/m5-serie` e compara estratégias de retenção periódica e híbrida (H15 + limiar de variação). O backend pagina a consulta em lotes de até 1.000 registros. Os indicadores de redução e erro são derivados de simulação sobre as amostras elegíveis, e não de uma mudança efetiva na transmissão do ESP32.

Para o total de pontos elegíveis `N` e pontos selecionados `N_s`:

$$
R_{\%}=100\left(1-\frac{N_s}{N}\right)
$$

Não converter redução simulada de pontos em economia comprovada de energia, bytes na rede ou requisições reais. O experimento retrospectivo EXP05 possui metodologia e recorte próprios em [M5 — Transformação de dados](metricas/05-transformacao-dados.md).

## 7. Limitações e verificações

- A presença do código na `main` não garante que a mesma revisão esteja implantada na Vercel.
- O estado operacional da estação não deve ser inferido apenas pela recência da telemetria.
- A rota de parecer depende de credencial de provedor e disponibilidade externa.
- Os experimentos EXP04c/EXP04d de persistência/replay não devem ser atribuídos automaticamente ao firmware v3.6.7 versionado na `main`.
- Uma mudança física da estação deve ser tratada como nova campanha, com confirmação e atualização de altitude e metadados.

## 8. Referências internas

- [README do dashboard Web](../web/README.md)
- [Camada Cloud](07-cloud.md)
- [Arquitetura](02-arquitetura.md)
- [Métricas e experimentos](metricas/README.md)
- [Resiliência M4](metricas/04-resiliencia.md)
- [Transformação de dados M5](metricas/05-transformacao-dados.md)
