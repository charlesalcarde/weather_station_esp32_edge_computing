import { buscarUltimaLeitura, calcularStatus, numeroOuNull } from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ erro: "metodo_nao_permitido", mensagem: "Use GET neste endpoint." });
  }
  try {
    const leitura = await buscarUltimaLeitura();
    res.setHeader("Cache-Control", "no-store, max-age=0");
    if (!leitura) return res.status(404).json({ erro: "sem_leituras", mensagem: "Nenhuma leitura foi encontrada para a estação configurada." });
    const externoDisponivel = leitura.externo_tem_dados === true;
    return res.status(200).json({
      estacao: leitura.estacao,
      nome_estacao: leitura.nome_estacao ?? null,
      hostname_local: leitura.hostname_local ?? null,
      status: calcularStatus(leitura.created_at),
      ultima_leitura: leitura.created_at,
      data_local: leitura.data_local ?? null,
      hora_local: leitura.hora_local ?? null,
      temperatura: numeroOuNull(leitura.temperatura),
      temperatura_media15: numeroOuNull(leitura.temperatura_media15),
      umidade: numeroOuNull(leitura.umidade),
      umidade_media15: numeroOuNull(leitura.umidade_media15),
      pressao_mar: numeroOuNull(leitura.pressao_mar),
      pressao_local: numeroOuNull(leitura.pressao_local),
      pressao_media15: numeroOuNull(leitura.pressao_media15),
      pressao_media60: numeroOuNull(leitura.pressao_media60),
      tendencia_pressao_hora: numeroOuNull(leitura.tendencia_pressao_hora),
      ponto_orvalho: numeroOuNull(leitura.ponto_orvalho),
      estado_geral: leitura.estado_geral ?? null,
      estado_umidade: leitura.estado_umidade ?? null,
      estado_conforto: leitura.estado_conforto ?? null,
      estado_pressao: leitura.estado_pressao ?? null,
      instabilidade: leitura.instabilidade ?? null,
      anomalia: leitura.anomalia ?? null,
      numero_alertas: leitura.numero_alertas ?? 0,
      rssi: leitura.rssi ?? null,
      altitude: numeroOuNull(leitura.altitude),
      origem_altitude: leitura.origem_altitude ?? null,
      externo: externoDisponivel ? {
        local: leitura.externo_local ?? null,
        atualizado: leitura.externo_atualizado ?? null,
        temperatura: numeroOuNull(leitura.externo_temperatura),
        sensacao: numeroOuNull(leitura.externo_sensacao),
        umidade: numeroOuNull(leitura.externo_umidade),
        ponto_orvalho: numeroOuNull(leitura.externo_orvalho),
        pressao_mar: numeroOuNull(leitura.externo_pressao_mar),
        pressao_superficie: numeroOuNull(leitura.externo_pressao_superficie),
        precipitacao: numeroOuNull(leitura.externo_precipitacao),
        chuva: numeroOuNull(leitura.externo_chuva),
        prob_chuva: numeroOuNull(leitura.externo_prob_chuva),
        nuvens: numeroOuNull(leitura.externo_nuvens),
        visibilidade: numeroOuNull(leitura.externo_visibilidade),
        uv: numeroOuNull(leitura.externo_uv),
        vento: numeroOuNull(leitura.externo_vento),
        direcao_vento: numeroOuNull(leitura.externo_direcao_vento),
        direcao_cardeal: leitura.externo_direcao_cardeal ?? null,
        rajada: numeroOuNull(leitura.externo_rajada),
        weather_code: leitura.externo_weather_code ?? null,
        is_day: leitura.externo_is_day ?? null
      } : null
    });
  } catch (erro) {
    console.error("[api/agora]", erro);
    return res.status(500).json({ erro: erro.code || "erro_interno", mensagem: "Não foi possível consultar o estado atual da estação." });
  }
}
