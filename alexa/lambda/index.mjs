const API_URL =
  "https://estacao-ambiental-chacaval.vercel.app/api/agora";

// =========================================================
// RESPOSTA PARA ALEXA
// encerrar = false mantém a conversa aberta
// =========================================================
function respostaAlexa(texto, encerrar = false, reprompt = null) {
  const response = {
    outputSpeech: {
      type: "PlainText",
      text: texto
    },
    shouldEndSession: encerrar
  };

  if (!encerrar) {
    response.reprompt = {
      outputSpeech: {
        type: "PlainText",
        text:
          reprompt ||
          "Você pode perguntar a temperatura, a umidade, a pressão, " +
          "o estado ambiental, pedir um resumo ou perguntar sobre a estação."
      }
    };
  }

  return {
    version: "1.0",
    response
  };
}

// =========================================================
// CONSULTA À API DA ESTAÇÃO
// =========================================================
async function obterDadosEstacao() {
  const response = await fetch(API_URL, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    throw new Error(`API respondeu HTTP ${response.status}`);
  }

  return await response.json();
}

// =========================================================
// FORMATAÇÃO NUMÉRICA
// =========================================================
function formatarNumero(valor, casas = 1) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return null;
  }

  return numero.toFixed(casas).replace(".", ",");
}

// =========================================================
// NORMALIZAÇÃO DE TEXTOS PARA FALA
//
// IMPORTANTE:
// Os códigos internos da API continuam sem acentos:
// ESTAVEL, ATENCAO, CONFORTAVEL etc.
//
// Esta função altera SOMENTE o texto pronunciado pela Alexa.
// =========================================================
function textoNatural(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }

  const original = String(valor).trim();
  const chave = original.toUpperCase();

  const mapa = {
    ESTAVEL: "estável",
    INSTAVEL: "instável",
    ATENCAO: "atenção",
    CONFORTAVEL: "confortável",
    DESCONFORTAVEL: "desconfortável",
    PRESSAO: "pressão",
    CONDICAO: "condição",

    "FAIXA MODERADA": "faixa moderada",
    "EM QUEDA": "em queda",
    SUBINDO: "subindo",

    BAIXA: "baixa",
    MODERADA: "moderada",
    ALTA: "alta",

    NENHUMA: "nenhuma",
    NORMAL: "normal",

    SECO: "seco",
    "MUITO SECO": "muito seco",

    UMIDO: "úmido",
    "MUITO UMIDO": "muito úmido",

    CRITICO: "crítico",
    CRITICA: "crítica"
  };

  if (mapa[chave]) {
    return mapa[chave];
  }

  // Fallback para frases compostas
  return original
    .toLowerCase()
    .replace(/\bestavel\b/g, "estável")
    .replace(/\binstavel\b/g, "instável")
    .replace(/\batencao\b/g, "atenção")
    .replace(/\bconfortavel\b/g, "confortável")
    .replace(/\bdesconfortavel\b/g, "desconfortável")
    .replace(/\bpressao\b/g, "pressão")
    .replace(/\bcondicao\b/g, "condição")
    .replace(/\bumido\b/g, "úmido")
    .replace(/\bcritico\b/g, "crítico")
    .replace(/\bcritica\b/g, "crítica")
    .replace(/\bprecipitacao\b/g, "precipitação")
    .replace(/\bsensacao\b/g, "sensação")
    .replace(/\bmaxima\b/g, "máxima")
    .replace(/\bminima\b/g, "mínima");
}

// =========================================================
// ESTADO AMBIENTAL
// =========================================================
function montarEstadoAmbiental(dados) {
  const estadoGeral = textoNatural(dados?.estado_geral);
  const estadoUmidade = textoNatural(dados?.estado_umidade);
  const estadoConforto = textoNatural(dados?.estado_conforto);
  const estadoPressao = textoNatural(dados?.estado_pressao);
  const instabilidade = textoNatural(dados?.instabilidade);
  const anomalia = textoNatural(dados?.anomalia);

  const numeroAlertas = Number(dados?.numero_alertas);

  const partes = [];

  if (estadoGeral && estadoConforto) {
    partes.push(
      `As condições ambientais estão ${estadoGeral} e o ambiente está ${estadoConforto}.`
    );
  } else if (estadoGeral) {
    partes.push(
      `As condições ambientais estão ${estadoGeral}.`
    );
  }

  if (estadoUmidade) {
    partes.push(
      `A umidade está em ${estadoUmidade}.`
    );
  }

  if (estadoPressao) {
    partes.push(
      `A condição da pressão está ${estadoPressao}.`
    );
  }

  if (instabilidade) {
    partes.push(
      `A instabilidade ambiental é ${instabilidade}.`
    );
  }

  if (anomalia) {
    if (anomalia === "nenhuma") {
      partes.push(
        "Não há anomalias detectadas."
      );
    } else {
      partes.push(
        `A estação detectou a seguinte condição anômala: ${anomalia}.`
      );
    }
  }

  if (Number.isFinite(numeroAlertas)) {
    if (numeroAlertas === 0) {
      partes.push(
        "Não há alertas ambientais ativos no momento."
      );
    } else if (numeroAlertas === 1) {
      partes.push(
        "Existe um alerta ambiental ativo."
      );
    } else {
      partes.push(
        `Existem ${numeroAlertas} alertas ambientais ativos.`
      );
    }
  }

  if (partes.length === 0) {
    return "Não consegui obter a interpretação ambiental da estação neste momento.";
  }

  return partes.join(" ");
}

// =========================================================
// RESUMO DA ESTAÇÃO
// =========================================================
function montarResumo(dados) {
  const temperatura = formatarNumero(dados?.temperatura);
  const umidade = formatarNumero(dados?.umidade);
  const pressaoMar = formatarNumero(dados?.pressao_mar);

  const estadoGeral = textoNatural(dados?.estado_geral);
  const estadoConforto = textoNatural(dados?.estado_conforto);
  const instabilidade = textoNatural(dados?.instabilidade);
  const anomalia = textoNatural(dados?.anomalia);

  const numeroAlertas = Number(dados?.numero_alertas);

  const partes = [];

  if (temperatura !== null) {
    partes.push(
      `A temperatura é de ${temperatura} graus Celsius.`
    );
  }

  if (umidade !== null) {
    partes.push(
      `A umidade relativa do ar é de ${umidade} por cento.`
    );
  }

  if (pressaoMar !== null) {
    partes.push(
      `A pressão atmosférica ao nível do mar é de ${pressaoMar} hectopascais.`
    );
  }

  if (estadoGeral && estadoConforto) {
    partes.push(
      `As condições ambientais estão ${estadoGeral} e o ambiente está ${estadoConforto}.`
    );
  } else if (estadoGeral) {
    partes.push(
      `As condições ambientais estão ${estadoGeral}.`
    );
  }

  if (instabilidade) {
    partes.push(
      `A instabilidade ambiental é ${instabilidade}.`
    );
  }

  if (anomalia && anomalia !== "nenhuma") {
    partes.push(
      `A estação detectou a seguinte condição anômala: ${anomalia}.`
    );
  }

  if (Number.isFinite(numeroAlertas)) {
    if (numeroAlertas === 0) {
      partes.push(
        "Não há alertas ambientais ativos."
      );
    } else if (numeroAlertas === 1) {
      partes.push(
        "Existe um alerta ambiental ativo."
      );
    } else {
      partes.push(
        `Existem ${numeroAlertas} alertas ambientais ativos.`
      );
    }
  }

  if (partes.length === 0) {
    return "Não consegui gerar o resumo da estação neste momento.";
  }

  return partes.join(" ");
}

// =========================================================
// APRESENTAÇÃO DA ESTAÇÃO
// =========================================================
function apresentarEstacao() {
  return (
    "A Estação Ambiental é uma plataforma experimental de Computação de Borda, " +
    "desenvolvida com um microcontrolador ESP32. " +

    "Ela utiliza sensores para medir temperatura, umidade e pressão atmosférica. " +

    "O próprio ESP32 realiza o processamento dos dados localmente, " +
    "calculando médias, tendências e condições ambientais. " +

    "A estação também possui uma interface Web local, " +
    "permitindo acompanhar as medições diretamente pela rede. " +

    "Os dados são enviados para a nuvem, onde podem ser armazenados, " +
    "consultados e visualizados remotamente por meio de um dashboard Web. " +

    "A arquitetura segue o princípio Edge primeiro, com a nuvem funcionando " +
    "como uma extensão para histórico, análise e acesso remoto. " +

    "A integração com a Alexa acrescenta uma interface conversacional ao projeto, " +
    "permitindo consultar as medições e análises ambientais por voz. " +

    "Você pode me perguntar a temperatura, a umidade, a pressão, " +
    "as condições ambientais ou pedir um resumo da estação."
  );
}

// =========================================================
// HANDLER PRINCIPAL
// =========================================================
export const handler = async (event) => {
  const requestType = event?.request?.type;
  const intentName = event?.request?.intent?.name;

  console.log("Request type:", requestType);
  console.log("Intent:", intentName);

  // =======================================================
  // ABERTURA DA SKILL
  // =======================================================
  if (requestType === "LaunchRequest") {
    return respostaAlexa(
      "Olá. Você está falando com a Estação Ambiental. " +
      "Posso informar temperatura, umidade, pressão, " +
      "estado ambiental, apresentar um resumo ou falar sobre o projeto. " +
      "O que você gostaria de saber?",
      false,
      "Você pode perguntar, por exemplo, qual é a temperatura, " +
      "pedir um resumo ou perguntar o que é a Estação Ambiental."
    );
  }

  // =======================================================
  // INTENTS
  // =======================================================
  if (requestType === "IntentRequest") {

    // -----------------------------------------------------
    // TEMPERATURA
    // -----------------------------------------------------
    if (intentName === "TemperaturaIntent") {
      try {
        const dados = await obterDadosEstacao();

        const temperatura =
          formatarNumero(dados?.temperatura);

        if (temperatura === null) {
          throw new Error(
            "Temperatura inválida ou ausente"
          );
        }

        return respostaAlexa(
          `A temperatura medida pela estação é de ${temperatura} graus Celsius. ` +
          "Posso informar mais alguma coisa?"
        );

      } catch (erro) {
        console.error(
          "Erro ao consultar temperatura:",
          erro
        );

        return respostaAlexa(
          "Não consegui consultar a temperatura da estação neste momento. " +
          "Você pode tentar outra informação."
        );
      }
    }

    // -----------------------------------------------------
    // UMIDADE
    // -----------------------------------------------------
    if (intentName === "UmidadeIntent") {
      try {
        const dados = await obterDadosEstacao();

        const umidade =
          formatarNumero(dados?.umidade);

        if (umidade === null) {
          throw new Error(
            "Umidade inválida ou ausente"
          );
        }

        return respostaAlexa(
          `A umidade relativa do ar medida pela estação é de ${umidade} por cento. ` +
          "Deseja saber mais alguma coisa?"
        );

      } catch (erro) {
        console.error(
          "Erro ao consultar umidade:",
          erro
        );

        return respostaAlexa(
          "Não consegui consultar a umidade da estação neste momento. " +
          "Você pode tentar outra informação."
        );
      }
    }

    // -----------------------------------------------------
    // PRESSÃO
    // -----------------------------------------------------
    if (intentName === "PressaoIntent") {
      try {
        const dados = await obterDadosEstacao();

        const pressaoMar =
          formatarNumero(dados?.pressao_mar);

        const pressaoLocal =
          formatarNumero(dados?.pressao_local);

        if (
          pressaoMar === null ||
          pressaoLocal === null
        ) {
          throw new Error(
            "Pressão inválida ou ausente"
          );
        }

        return respostaAlexa(
          `A pressão atmosférica ao nível do mar é de ${pressaoMar} hectopascais, ` +
          `e a pressão local medida pela estação é de ${pressaoLocal} hectopascais. ` +
          "Posso informar mais alguma coisa?"
        );

      } catch (erro) {
        console.error(
          "Erro ao consultar pressão:",
          erro
        );

        return respostaAlexa(
          "Não consegui consultar a pressão atmosférica da estação neste momento. " +
          "Você pode tentar outra informação."
        );
      }
    }

    // -----------------------------------------------------
    // ESTADO AMBIENTAL
    // -----------------------------------------------------
    if (intentName === "EstadoIntent") {
      try {
        const dados = await obterDadosEstacao();

        const estado =
          montarEstadoAmbiental(dados);

        return respostaAlexa(
          `${estado} Posso informar mais alguma coisa?`
        );

      } catch (erro) {
        console.error(
          "Erro ao consultar estado ambiental:",
          erro
        );

        return respostaAlexa(
          "Não consegui consultar o estado ambiental da estação neste momento. " +
          "Você pode tentar outra informação."
        );
      }
    }

    // -----------------------------------------------------
    // RESUMO
    // -----------------------------------------------------
    if (intentName === "ResumoIntent") {
      try {
        const dados = await obterDadosEstacao();

        const resumo =
          montarResumo(dados);

        return respostaAlexa(
          `${resumo} Posso informar mais alguma coisa?`
        );

      } catch (erro) {
        console.error(
          "Erro ao gerar resumo:",
          erro
        );

        return respostaAlexa(
          "Não consegui gerar o resumo da estação neste momento. " +
          "Você pode tentar outra informação."
        );
      }
    }

    // -----------------------------------------------------
    // SOBRE A ESTAÇÃO
    // -----------------------------------------------------
    if (intentName === "SobreIntent") {
      const apresentacao = apresentarEstacao();

      return respostaAlexa(
        apresentacao,
        false,
        "Posso informar a temperatura, a umidade, a pressão, " +
        "o estado ambiental ou apresentar um resumo."
      );
    }

    // -----------------------------------------------------
    // AJUDA
    // -----------------------------------------------------
    if (intentName === "AMAZON.HelpIntent") {
      return respostaAlexa(
        "Você pode perguntar a temperatura, a umidade, a pressão, " +
        "como está o ambiente, pedir um resumo ou perguntar sobre a estação. " +
        "O que gostaria de saber?"
      );
    }

    // -----------------------------------------------------
    // PARAR / CANCELAR
    // -----------------------------------------------------
    if (
      intentName === "AMAZON.StopIntent" ||
      intentName === "AMAZON.CancelIntent"
    ) {
      return respostaAlexa(
        "Até mais.",
        true
      );
    }

    // -----------------------------------------------------
    // FALLBACK
    // -----------------------------------------------------
    if (intentName === "AMAZON.FallbackIntent") {
      return respostaAlexa(
        "Não entendi essa pergunta. " +
        "Você pode perguntar a temperatura, a umidade, a pressão, " +
        "o estado ambiental, pedir um resumo ou perguntar sobre a estação."
      );
    }
  }

  // =======================================================
  // OUTRAS REQUISIÇÕES
  // =======================================================
  return respostaAlexa(
    "Não entendi. Você pode perguntar a temperatura, a umidade, " +
    "a pressão, o estado ambiental, pedir um resumo ou perguntar sobre a estação."
  );
};
