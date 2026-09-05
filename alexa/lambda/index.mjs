const API_URL = "https://estacao-ambiental-chacaval.vercel.app/api/agora";

function respostaAlexa(texto, encerrar = false, reprompt = null) {
  const response = {
    outputSpeech: { type: "PlainText", text: texto },
    shouldEndSession: encerrar
  };

  if (!encerrar) {
    response.reprompt = {
      outputSpeech: {
        type: "PlainText",
        text: reprompt ||
          "Você pode perguntar a temperatura, a umidade, a pressão, o estado ambiental, pedir um resumo ou perguntar sobre a estação."
      }
    };
  }

  return { version: "1.0", response };
}

async function obterDadosEstacao() {
  const response = await fetch(API_URL, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error(`API respondeu HTTP ${response.status}`);
  return await response.json();
}

function formatarNumero(valor, casas = 1) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  return numero.toFixed(casas).replace(".", ",");
}

function textoNatural(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim().toLowerCase();
}

function montarEstadoAmbiental(dados) {
  const estadoGeral = textoNatural(dados?.estado_geral);
  const estadoUmidade = textoNatural(dados?.estado_umidade);
  const estadoConforto = textoNatural(dados?.estado_conforto);
  const estadoPressao = textoNatural(dados?.estado_pressao);
  const instabilidade = textoNatural(dados?.instabilidade);
  const anomalia = textoNatural(dados?.anomalia);
  const numeroAlertas = Number(dados?.numero_alertas);
  const partes = [];

  if (estadoGeral && estadoConforto) partes.push(`As condições ambientais estão ${estadoGeral} e o ambiente está ${estadoConforto}.`);
  else if (estadoGeral) partes.push(`As condições ambientais estão ${estadoGeral}.`);
  if (estadoUmidade) partes.push(`A umidade está em ${estadoUmidade}.`);
  if (estadoPressao) partes.push(`A condição da pressão está ${estadoPressao}.`);
  if (instabilidade) partes.push(`A instabilidade ambiental é ${instabilidade}.`);
  if (anomalia === "nenhuma") partes.push("Não há anomalias detectadas.");
  else if (anomalia) partes.push(`A estação detectou a seguinte condição anômala: ${anomalia}.`);

  if (Number.isFinite(numeroAlertas)) {
    if (numeroAlertas === 0) partes.push("Não há alertas ambientais ativos no momento.");
    else if (numeroAlertas === 1) partes.push("Existe um alerta ambiental ativo.");
    else partes.push(`Existem ${numeroAlertas} alertas ambientais ativos.`);
  }
  return partes.length ? partes.join(" ") : "Não consegui obter a interpretação ambiental da estação neste momento.";
}

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

  if (temperatura !== null) partes.push(`A temperatura é de ${temperatura} graus Celsius.`);
  if (umidade !== null) partes.push(`A umidade relativa do ar é de ${umidade} por cento.`);
  if (pressaoMar !== null) partes.push(`A pressão atmosférica ao nível do mar é de ${pressaoMar} hectopascais.`);
  if (estadoGeral && estadoConforto) partes.push(`As condições ambientais estão ${estadoGeral} e o ambiente está ${estadoConforto}.`);
  else if (estadoGeral) partes.push(`As condições ambientais estão ${estadoGeral}.`);
  if (instabilidade) partes.push(`A instabilidade ambiental é ${instabilidade}.`);
  if (anomalia && anomalia !== "nenhuma") partes.push(`A estação detectou a seguinte condição anômala: ${anomalia}.`);
  if (Number.isFinite(numeroAlertas)) {
    if (numeroAlertas === 0) partes.push("Não há alertas ambientais ativos.");
    else if (numeroAlertas === 1) partes.push("Existe um alerta ambiental ativo.");
    else partes.push(`Existem ${numeroAlertas} alertas ambientais ativos.`);
  }
  return partes.length ? partes.join(" ") : "Não consegui gerar o resumo da estação neste momento.";
}

function apresentarEstacao() {
  return "A Estação Ambiental é uma plataforma experimental de Computação de Borda, desenvolvida com um microcontrolador ESP32. " +
    "Ela utiliza sensores para medir temperatura, umidade e pressão atmosférica. " +
    "O próprio ESP32 realiza o processamento dos dados localmente, calculando médias, tendências e condições ambientais. " +
    "A estação também possui uma interface Web local, permitindo acompanhar as medições diretamente pela rede. " +
    "Os dados são enviados para a nuvem, onde podem ser armazenados, consultados e visualizados remotamente por meio de um dashboard Web. " +
    "A arquitetura segue o princípio Edge primeiro, com a nuvem funcionando como uma extensão para histórico, análise e acesso remoto. " +
    "A integração com a Alexa acrescenta uma interface conversacional ao projeto, permitindo consultar as medições e análises ambientais por voz. " +
    "Você pode me perguntar a temperatura, a umidade, a pressão, as condições ambientais ou pedir um resumo da estação.";
}

export const handler = async (event) => {
  const requestType = event?.request?.type;
  const intentName = event?.request?.intent?.name;
  console.log("Request type:", requestType);
  console.log("Intent:", intentName);

  if (requestType === "LaunchRequest") {
    return respostaAlexa("Olá. Você está falando com a Estação Ambiental. Posso informar temperatura, umidade, pressão, estado ambiental, apresentar um resumo ou falar sobre o projeto. O que você gostaria de saber?", false,
      "Você pode perguntar, por exemplo, qual é a temperatura, pedir um resumo ou perguntar o que é a Estação Ambiental.");
  }

  if (requestType === "IntentRequest") {
    try {
      if (intentName === "TemperaturaIntent") {
        const d = await obterDadosEstacao(); const v = formatarNumero(d?.temperatura);
        if (v === null) throw new Error("Temperatura inválida ou ausente");
        return respostaAlexa(`A temperatura medida pela estação é de ${v} graus Celsius. Posso informar mais alguma coisa?`);
      }
      if (intentName === "UmidadeIntent") {
        const d = await obterDadosEstacao(); const v = formatarNumero(d?.umidade);
        if (v === null) throw new Error("Umidade inválida ou ausente");
        return respostaAlexa(`A umidade relativa do ar medida pela estação é de ${v} por cento. Deseja saber mais alguma coisa?`);
      }
      if (intentName === "PressaoIntent") {
        const d = await obterDadosEstacao(); const mar = formatarNumero(d?.pressao_mar); const local = formatarNumero(d?.pressao_local);
        if (mar === null || local === null) throw new Error("Pressão inválida ou ausente");
        return respostaAlexa(`A pressão atmosférica ao nível do mar é de ${mar} hectopascais, e a pressão local medida pela estação é de ${local} hectopascais. Posso informar mais alguma coisa?`);
      }
      if (intentName === "EstadoIntent") {
        const d = await obterDadosEstacao(); return respostaAlexa(`${montarEstadoAmbiental(d)} Posso informar mais alguma coisa?`);
      }
      if (intentName === "ResumoIntent") {
        const d = await obterDadosEstacao(); return respostaAlexa(`${montarResumo(d)} Posso informar mais alguma coisa?`);
      }
      if (intentName === "SobreIntent") {
        return respostaAlexa(apresentarEstacao(), false, "Posso informar a temperatura, a umidade, a pressão, o estado ambiental ou apresentar um resumo.");
      }
    } catch (erro) {
      console.error("Erro na consulta:", erro);
      return respostaAlexa("Não consegui consultar a estação neste momento. Você pode tentar outra informação.");
    }

    if (intentName === "AMAZON.HelpIntent") return respostaAlexa("Você pode perguntar a temperatura, a umidade, a pressão, como está o ambiente, pedir um resumo ou perguntar sobre a estação. O que gostaria de saber?");
    if (intentName === "AMAZON.StopIntent" || intentName === "AMAZON.CancelIntent") return respostaAlexa("Até mais.", true);
    if (intentName === "AMAZON.FallbackIntent") return respostaAlexa("Não entendi essa pergunta. Você pode perguntar a temperatura, a umidade, a pressão, o estado ambiental, pedir um resumo ou perguntar sobre a estação.");
  }

  return respostaAlexa("Não entendi. Você pode perguntar a temperatura, a umidade, a pressão, o estado ambiental, pedir um resumo ou perguntar sobre a estação.");
};
