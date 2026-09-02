const CAMPOS_AGORA = [
  "id",
  "created_at",
  "estacao",
  "nome_estacao",
  "hostname_local",
  "data_local",
  "hora_local",
  "temperatura",
  "temperatura_media15",
  "umidade",
  "umidade_media15",
  "pressao_mar",
  "pressao_local",
  "pressao_media15",
  "pressao_media60",
  "tendencia_pressao_hora",
  "ponto_orvalho",
  "estado_geral",
  "estado_umidade",
  "estado_conforto",
  "estado_pressao",
  "instabilidade",
  "anomalia",
  "numero_alertas",
  "rssi",
  "altitude",
  "origem_altitude",
  "externo_tem_dados",
  "externo_local",
  "externo_atualizado",
  "externo_temperatura",
  "externo_sensacao",
  "externo_umidade",
  "externo_orvalho",
  "externo_pressao_mar",
  "externo_pressao_superficie",
  "externo_precipitacao",
  "externo_chuva",
  "externo_prob_chuva",
  "externo_nuvens",
  "externo_visibilidade",
  "externo_uv",
  "externo_vento",
  "externo_direcao_vento",
  "externo_direcao_cardeal",
  "externo_rajada",
  "externo_weather_code",
  "externo_is_day"
].join(",");

export function getConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const estacao = process.env.ESTACAO_ID || "EA-0001";

  if (!url || !serviceRole) {
    const erro = new Error("Configuração do Supabase ausente no servidor.");
    erro.code = "configuracao_ausente";
    throw erro;
  }

  return {
    url: url.replace(/\/$/, ""),
    serviceRole,
    estacao
  };
}

async function supabaseFetch(endpoint, options = {}) {
  const { serviceRole } = getConfig();

  const resposta = await fetch(endpoint, {
    ...options,
    headers: {
      apikey: serviceRole,
      // ADICIONE ESTA LINHA ABAIXO PARA ENVIAR O JWT DE FORMA EXPLÍCITA
      Authorization: `Bearer ${serviceRole}`, 
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    const erro = new Error(`Falha ao consultar Supabase: HTTP ${resposta.status}`);
    erro.code = "supabase_erro";
    erro.status = resposta.status;
    erro.detail = detalhe;
    throw erro;
  }

  return resposta;
}

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    const erro = new Error(`Falha ao consultar Supabase: HTTP ${resposta.status}`);
    erro.code = "supabase_erro";
    erro.status = resposta.status;
    erro.detail = detalhe;
    throw erro;
  }

  return resposta;
}

export async function buscarUltimaLeitura() {
  const { url, estacao } = getConfig();

  const endpoint = new URL(`${url}/rest/v1/leituras`);
  endpoint.searchParams.set("select", CAMPOS_AGORA);
  endpoint.searchParams.set("estacao", `eq.${estacao}`);
  endpoint.searchParams.set("order", "created_at.desc");
  endpoint.searchParams.set("limit", "1");

  const resposta = await supabaseFetch(endpoint, { method: "GET" });
  const dados = await resposta.json();
  return dados[0] ?? null;
}

export async function buscarHistoricoAgregado({
  estacao,
  inicio,
  fim,
  bucketSeconds
}) {
  const { url } = getConfig();
  const endpoint = `${url}/rest/v1/rpc/historico_estacao_v34`;

  const resposta = await supabaseFetch(endpoint, {
    method: "POST",
    body: JSON.stringify({
      p_estacao: estacao,
      p_inicio: inicio,
      p_fim: fim,
      p_bucket_seconds: bucketSeconds
    })
  });

  return await resposta.json();
}


export async function buscarResumoEstatistico({ estacao, inicio, fim }) {
  const { url } = getConfig();
  const endpoint = `${url}/rest/v1/rpc/resumo_estacao_v34`;

  const resposta = await supabaseFetch(endpoint, {
    method: "POST",
    body: JSON.stringify({
      p_estacao: estacao,
      p_inicio: inicio,
      p_fim: fim
    })
  });

  return await resposta.json();
}

export function calcularStatus(createdAt) {
  if (!createdAt) return "offline";

  const idadeMs = Date.now() - new Date(createdAt).getTime();
  if (!Number.isFinite(idadeMs)) return "offline";

  const idadeMin = idadeMs / 60000;

  if (idadeMin < 2) return "online";
  if (idadeMin <= 5) return "atraso";
  return "offline";
}

export function numeroOuNull(valor) {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}
