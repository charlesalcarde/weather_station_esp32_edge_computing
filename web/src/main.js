import "./style.css";
import Chart from "chart.js/auto";

let filtroAtual = { tipo: "periodo", valor: "24h", rotulo: "24 h" };
let ultimoHistorico = null;
const charts = {};

const INTERVALO_AGORA_S = 60;
const INTERVALO_HISTORICO_MS = 5 * 60 * 1000;
let segundosParaAtualizar = INTERVALO_AGORA_S;
let atualizandoAgora = false;
let atualizandoHistorico = false;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const INFO = {
  "sobre-estacao": {
    eyebrow: "Sobre o projeto",
    title: "Estação Ambiental Experimental",
    body: `
      <p>Esta estação é uma plataforma experimental de monitoramento ambiental baseada em <strong>Computação de Borda (Edge Computing)</strong>.</p>
      <p>Os sensores são conectados diretamente a um ESP32. O próprio microcontrolador realiza a aquisição, os cálculos, as médias, a análise de tendência, as conversões, a classificação de estados ambientais e a detecção de eventos.</p>
      <div class="modal-highlight"><strong>Edge primeiro; Cloud como extensão.</strong><br>A operação ambiental principal não depende de Supabase, Vercel ou Open-Meteo.</div>
      <p>A camada Cloud acrescenta armazenamento histórico, acesso remoto e análises. A Open-Meteo é utilizada apenas como referência meteorológica externa.</p>
    `
  },
  "edge-computing": {
    eyebrow: "Arquitetura",
    title: "O que significa Computação de Borda aqui?",
    body: `
      <p>Computação de Borda significa processar os dados próximo de onde eles são produzidos. Nesta estação, a borda é o próprio <strong>ESP32</strong>.</p>
      <ul><li>Aquisição dos sensores.</li><li>Médias móveis.</li><li>Tendência da pressão.</li><li>Conversões e ponto de orvalho.</li><li>Estados ambientais e alertas.</li><li>Registro e apresentação local.</li></ul>
      <p>Se a Internet ou a Cloud estiverem indisponíveis, a estação continua realizando essas funções. A conectividade é uma extensão da estação, não o seu núcleo operacional.</p>
    `
  },
  "medicoes-locais": {
    eyebrow: "Origem dos dados",
    title: "O que estas condições representam?",
    body: `
      <p>Estas informações descrevem o <strong>microambiente onde a estação está fisicamente instalada</strong>.</p>
      <p>Atualmente, o equipamento encontra-se em ambiente interno/isolado do meio externo. Assim, os valores locais não devem ser interpretados automaticamente como a condição meteorológica externa de Campinas.</p>
      <p>A comparação com a Open-Meteo existe justamente para distinguir a medição local da referência meteorológica externa.</p>
    `
  },
  "status": {
    eyebrow: "Conectividade",
    title: "Status da estação",
    body: `<p>Indica a recência da última telemetria recebida pela plataforma Web. É um indicador de comunicação remota e não significa, por si só, que o processamento local do ESP32 esteja parado.</p>`
  },
  "temperatura": {
    eyebrow: "Medição local",
    title: "Temperatura",
    body: `<p>Temperatura utilizada como referência principal da estação e medida localmente pelo <strong>BMP180</strong>. O valor é adquirido pelo ESP32 e processado na borda.</p>`
  },
  "umidade": {
    eyebrow: "Medição local",
    title: "Umidade relativa do ar",
    body: `<p>Umidade relativa medida localmente pelo <strong>DHT11</strong>. Representa a quantidade relativa de vapor de água presente no ar do ambiente onde a estação está instalada.</p>`
  },
  "pressao-mar": {
    eyebrow: "Calculado no Edge",
    title: "Pressão ao nível do mar",
    body: `<p>É a pressão atmosférica local corrigida para uma referência equivalente ao nível do mar, utilizando a altitude da estação. Essa conversão facilita a comparação com referências meteorológicas externas.</p>`
  },
  "pressao-local": {
    eyebrow: "Medição local",
    title: "Pressão local",
    body: `<p>Pressão atmosférica medida pelo BMP180 na altitude física onde a estação está instalada. Diferentemente da pressão ao nível do mar, este valor não é normalizado para altitude zero.</p>`
  },
  "ponto-orvalho": {
    eyebrow: "Calculado no Edge",
    title: "Ponto de orvalho",
    body: `<p>Temperatura estimada na qual o vapor de água presente no ar começaria a condensar. É calculada localmente pelo ESP32 a partir de temperatura e umidade.</p>`
  },
  "tendencia-pressao": {
    eyebrow: "Calculado no Edge",
    title: "Tendência da pressão",
    body: `<p>Taxa de variação da pressão atmosférica ao longo do tempo, expressa em hPa/h. É calculada pela própria estação a partir do histórico recente. Valores positivos indicam tendência de aumento; valores negativos, tendência de queda.</p>`
  },
  "estado-geral": {
    eyebrow: "Interpretação no Edge",
    title: "Estado geral",
    body: `<p>Síntese produzida pelo processamento local da estação a partir das variáveis ambientais, tendências e regras definidas no firmware. Não é uma classificação fornecida pela Cloud.</p>`
  },
  "rssi": {
    eyebrow: "Conectividade",
    title: "RSSI",
    body: `<p>Indicador da intensidade do sinal Wi-Fi recebido pelo ESP32, medido em dBm. Valores menos negativos representam, em geral, sinal mais forte. Ele descreve a conectividade e não a condição ambiental.</p>`
  },
  "open-meteo": {
    eyebrow: "Fonte externa",
    title: "O que é Open-Meteo?",
    body: `
      <p><strong>Open-Meteo</strong> é um serviço externo de dados meteorológicos consultado pela estação/plataforma por API.</p>
      <p>Seus dados não são medições produzidas pelos sensores locais. Eles funcionam como <strong>referência meteorológica externa</strong> para a localização configurada e permitem comparar o microambiente da estação com as condições externas estimadas.</p>
      <div class="modal-highlight">Estação = medição local.<br>Open-Meteo = referência externa.</div>
    `
  },
  "historico": {
    eyebrow: "Cloud",
    title: "Histórico e evolução temporal",
    body: `<p>Os dados enviados pelo ESP32 são armazenados no Supabase. A camada Web consulta esse histórico por meio das APIs serverless da Vercel e apresenta a evolução temporal sem transferir o processamento ambiental principal para a nuvem.</p>`
  },
  "delta": {
    eyebrow: "Comparação",
    title: "Δ Estação − Open-Meteo",
    body: `<p>O delta mostra a diferença entre a medição/valor da estação e a referência externa da Open-Meteo. Um valor positivo significa que a estação está acima da referência; um valor negativo, abaixo.</p><p>Essa diferença é especialmente útil porque a estação encontra-se em um microambiente local que pode responder de forma diferente das condições externas.</p>`
  },
  "resumo": {
    eyebrow: "Análise histórica",
    title: "Resumo do período",
    body: `<p>Apresenta estatísticas do período selecionado, como mínimo, média, máximo e amplitude. Esses valores são derivados do histórico armazenado na Cloud para facilitar análise temporal.</p>`
  }
};

const CARD_META = {
  "Status": { info: "status", kind: "connectivity", badge: "Conectividade" },
  "Temperatura": { info: "temperatura", kind: "measured", badge: "Medido" },
  "Umidade": { info: "umidade", kind: "measured", badge: "Medido" },
  "Pressão mar": { info: "pressao-mar", kind: "calculated", badge: "Edge" },
  "Pressão local": { info: "pressao-local", kind: "measured", badge: "Medido" },
  "Ponto de orvalho": { info: "ponto-orvalho", kind: "calculated", badge: "Edge" },
  "Tendência pressão": { info: "tendencia-pressao", kind: "calculated", badge: "Edge" },
  "Estado geral": { info: "estado-geral", kind: "calculated", badge: "Edge" },
  "RSSI": { info: "rssi", kind: "connectivity", badge: "Conectividade" }
};

function fmtNumero(valor, casas = 1) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "—";
  return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function fmtDataHora(valor) {
  if (!valor) return "—";
  const data = new Date(valor);
  return Number.isFinite(data.getTime()) ? data.toLocaleString("pt-BR") : "—";
}

function dataInput(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function abrirInfo(chave) {
  const info = INFO[chave];
  if (!info) return;
  $("#info-modal-eyebrow").textContent = info.eyebrow || "Informação";
  $("#info-modal-title").textContent = info.title;
  $("#info-modal-body").innerHTML = info.body;
  $("#info-modal").classList.remove("hidden");
  document.body.classList.add("modal-open");
  $("#info-modal-close").focus();
}

function fecharInfo() {
  $("#info-modal").classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function configurarInfos() {
  $$(".info-action").forEach((el) => el.addEventListener("click", () => abrirInfo(el.dataset.info)));
  $("#info-modal-close").addEventListener("click", fecharInfo);
  $("#info-modal").addEventListener("click", (ev) => { if (ev.target === $("#info-modal")) fecharInfo(); });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !$("#info-modal").classList.contains("hidden")) fecharInfo(); });
}

function setConexao(status) {
  const dot = $("#connection-dot");
  const texto = $("#connection-text");
  dot.className = "dot";
  if (status === "online") { dot.classList.add("online"); texto.textContent = "estação online"; }
  else if (status === "atraso") { dot.classList.add("delay"); texto.textContent = "estação com atraso"; }
  else { dot.classList.add("offline"); texto.textContent = "estação offline"; }
}

function card(rotulo, valor) {
  const meta = CARD_META[rotulo] || {};
  return `<article class="metric-card ${meta.kind || ""}">
    <div class="metric-card-head">
      <span>${rotulo}</span>
      ${meta.info ? `<button class="info-icon metric-info" type="button" data-card-info="${meta.info}" aria-label="Explicação sobre ${rotulo}">i</button>` : ""}
    </div>
    <strong>${valor}</strong>
    ${meta.badge ? `<small class="metric-origin ${meta.kind || ""}">${meta.badge}</small>` : ""}
  </article>`;
}

function renderIdentidade(d) {
  const local = d.externo?.local || "—";
  $("#station-code").textContent = d.estacao || "—";
  $("#station-name").textContent = d.nome_estacao || "—";
  $("#station-location").textContent = local;
  $("#station-altitude").textContent = d.altitude == null ? "—" : `${fmtNumero(d.altitude, 0)} m`;
}

function renderAgora(d) {
  setConexao(d.status);
  renderIdentidade(d);
  const itens = [
    ["Status", (d.status || "—").toUpperCase()],
    ["Temperatura", `${fmtNumero(d.temperatura)} °C`],
    ["Umidade", `${fmtNumero(d.umidade, 0)} %`],
    ["Pressão mar", `${fmtNumero(d.pressao_mar, 1)} hPa`],
    ["Pressão local", `${fmtNumero(d.pressao_local, 1)} hPa`],
    ["Ponto de orvalho", `${fmtNumero(d.ponto_orvalho)} °C`],
    ["Tendência pressão", `${fmtNumero(d.tendencia_pressao_hora, 2)} hPa/h`],
    ["Estado geral", d.estado_geral || "—"],
    ["RSSI", `${fmtNumero(d.rssi, 0)} dBm`]
  ];
  $("#cards-agora").innerHTML = itens.map(([r,v]) => card(r,v)).join("");
  $$("[data-card-info]").forEach((el) => el.addEventListener("click", () => abrirInfo(el.dataset.cardInfo)));
  $("#ultima-leitura").textContent = `Última leitura: ${fmtDataHora(d.ultima_leitura)}`;
  $("#nome-estacao").textContent = `Estação: ${d.nome_estacao || d.estacao || "—"}`;
}

async function carregarAgora() {
  $("#connection-text").textContent = "consultando...";
  try {
    const resp = await fetch("/api/agora", { cache: "no-store" });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.mensagem || `HTTP ${resp.status}`);
    renderAgora(dados);
    return dados;
  } catch (erro) {
    setConexao("offline");
    throw erro;
  }
}

function queryAtual() {
  return filtroAtual.tipo === "periodo"
    ? `periodo=${encodeURIComponent(filtroAtual.valor)}`
    : `inicio=${encodeURIComponent(filtroAtual.inicio)}&fim=${encodeURIComponent(filtroAtual.fim)}`;
}

function labelTempo(timestamp) {
  const d = new Date(timestamp);
  const inicio = ultimoHistorico?.periodo?.inicio ? new Date(ultimoHistorico.periodo.inicio) : null;
  const fim = ultimoHistorico?.periodo?.fim ? new Date(ultimoHistorico.periodo.fim) : null;
  const dias = inicio && fim ? (fim - inicio) / 86400000 : 1;
  if (dias <= 1.2) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (dias <= 8) return d.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
  return d.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit" });
}

function temaChart() {
  const css = getComputedStyle(document.documentElement);
  return {
    texto: css.getPropertyValue("--chart-text").trim(),
    grade: css.getPropertyValue("--chart-grid").trim(),
    estacao: css.getPropertyValue("--chart-station").trim(),
    externo: css.getPropertyValue("--chart-external").trim(),
    delta: css.getPropertyValue("--chart-delta").trim()
  };
}

function datasetSerie(label, data, tipo = "estacao") {
  const t = temaChart();
  return {
    label, data, borderWidth: tipo === "externo" ? 1.5 : 2, pointRadius: 0,
    tension: 0.18, spanGaps: true,
    borderColor: tipo === "externo" ? t.externo : tipo === "delta" ? t.delta : t.estacao,
    backgroundColor: tipo === "externo" ? t.externo : tipo === "delta" ? t.delta : t.estacao,
    ...(tipo === "externo" ? { borderDash: [6,5] } : {})
  };
}

function criarChart(id, labels, datasets) {
  if (charts[id]) charts[id].destroy();
  const t = temaChart();
  charts[id] = new Chart(document.getElementById(id), {
    type: "line", data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: true, position: "bottom", labels: { color: t.texto } },
        tooltip: { callbacks: { title(items) {
          const i = items?.[0]?.dataIndex;
          const ts = ultimoHistorico?.dados?.[i]?.timestamp;
          return ts ? new Date(ts).toLocaleString("pt-BR") : "";
        } } }
      },
      scales: {
        x: { ticks: { maxTicksLimit: 10, autoSkip: true, color: t.texto }, grid: { color: t.grade } },
        y: { ticks: { maxTicksLimit: 6, color: t.texto }, grid: { color: t.grade } }
      }
    }
  });
}

function delta(a,b) { return typeof a === "number" && typeof b === "number" ? a-b : null; }

function aplicarVisibilidadeGlobal() {
  const est = $("#serie-estacao").checked;
  const ext = $("#serie-openmeteo").checked;
  ["chart-temperatura","chart-umidade","chart-pressao"].forEach(id => {
    const c=charts[id]; if(!c) return;
    c.setDatasetVisibility(0, est); c.setDatasetVisibility(1, ext); c.update();
  });
  const orv=charts["chart-orvalho"];
  if(orv){ orv.setDatasetVisibility(0, est); orv.update(); }
}

function renderHistorico(h) {
  ultimoHistorico = h;
  const d = Array.isArray(h.dados) ? h.dados : [];
  const labels = d.map(p => labelTempo(p.timestamp));
  criarChart("chart-temperatura", labels, [datasetSerie("Estação", d.map(p=>p.temperatura)), datasetSerie("Open-Meteo", d.map(p=>p.externo_temperatura), "externo")]);
  criarChart("chart-umidade", labels, [datasetSerie("Estação", d.map(p=>p.umidade)), datasetSerie("Open-Meteo", d.map(p=>p.externo_umidade), "externo")]);
  criarChart("chart-pressao", labels, [datasetSerie("Estação", d.map(p=>p.pressao_mar)), datasetSerie("Open-Meteo", d.map(p=>p.externo_pressao_mar), "externo")]);
  criarChart("chart-orvalho", labels, [datasetSerie("Estação", d.map(p=>p.ponto_orvalho))]);
  criarChart("chart-delta-temperatura", labels, [datasetSerie("Δ temperatura", d.map(p=>delta(p.temperatura,p.externo_temperatura)), "delta")]);
  criarChart("chart-delta-umidade", labels, [datasetSerie("Δ umidade", d.map(p=>delta(p.umidade,p.externo_umidade)), "delta")]);
  criarChart("chart-delta-pressao", labels, [datasetSerie("Δ pressão", d.map(p=>delta(p.pressao_mar,p.externo_pressao_mar)), "delta")]);
  $("#periodo-info").textContent = `Período: ${filtroAtual.rotulo}`;
  const comparacaoPeriodo = $("#comparacao-periodo-info");
  if (comparacaoPeriodo) comparacaoPeriodo.textContent = `Comparação estatística: ${filtroAtual.rotulo}.`;
  $("#resolucao-info").textContent = `Resolução: ${h.resolucao || "—"}`;
  $("#amostras-info").textContent = `Amostras: ${h.amostras_brutas ?? "—"}`;
  aplicarVisibilidadeGlobal();
}

function statLine(rotulo, valor, unidade) { return `<div class="stat-line"><span>${rotulo}</span><strong>${valor}${unidade}</strong></div>`; }
function summaryCard(titulo, bloco, unidade, amplitude=false) {
  return `<article class="summary-card"><h3>${titulo}</h3>${statLine("Mínimo",fmtNumero(bloco?.min),` ${unidade}`)}${statLine("Média",fmtNumero(bloco?.media),` ${unidade}`)}${statLine("Máximo",fmtNumero(bloco?.max),` ${unidade}`)}${amplitude?statLine("Amplitude",fmtNumero(bloco?.amplitude),` ${unidade}`):""}</article>`;
}

function renderResumo(r) {
  $("#cards-resumo").innerHTML = [summaryCard("Temperatura",r.temperatura,"°C",true),summaryCard("Umidade",r.umidade,"%"),summaryCard("Pressão mar",r.pressao_mar,"hPa",true),summaryCard("Pressão local",r.pressao_local,"hPa",true),summaryCard("Ponto de orvalho",r.ponto_orvalho,"°C")].join("");
  const ext=r.externo||{};
  const comps=[["Temperatura média",r.temperatura?.media,ext.temperatura?.media,"°C"],["Umidade média",r.umidade?.media,ext.umidade?.media,"%"],["Pressão média",r.pressao_mar?.media,ext.pressao_mar?.media,"hPa"]];
  $("#cards-comparacao").innerHTML=comps.map(([rotulo,est,ex,un])=>{ const d=delta(est,ex); const dt=d===null?"—":`${d>=0?"+":""}${fmtNumero(d)} ${un}`; return `<article class="comparison-card"><h3>${rotulo}</h3><div class="comparison-values"><div><span>Estação</span><strong>${fmtNumero(est)} ${un}</strong></div><div><span>Open-Meteo</span><strong>${fmtNumero(ex)} ${un}</strong></div><div><span>Δ</span><strong>${dt}</strong></div></div></article>`; }).join("");
}

async function carregarHistoricoEResumo() {
  const q=queryAtual();
  const [rh,rr]=await Promise.all([fetch(`/api/historico?${q}`,{cache:"no-store"}),fetch(`/api/resumo?${q}`,{cache:"no-store"})]);
  const [h,r]=await Promise.all([rh.json(),rr.json()]);
  if(!rh.ok) throw new Error(h.mensagem||`Histórico HTTP ${rh.status}`);
  if(!rr.ok) throw new Error(r.mensagem||`Resumo HTTP ${rr.status}`);
  renderHistorico(h); renderResumo(r);
}

function definirInputsPadrao() {
  const hoje=new Date(), inicio=new Date(hoje); inicio.setDate(inicio.getDate()-7);
  $("#data-inicio").value=dataInput(inicio); $("#data-fim").value=dataInput(hoje);
}

async function selecionarPeriodo(tipo) {
  $("#erro-periodo").textContent="";
  $$(".period-button").forEach(b=>b.classList.toggle("active",b.dataset.periodo===tipo));
  if(tipo==="personalizado") { $("#custom-period").classList.remove("hidden"); return; }
  $("#custom-period").classList.add("hidden");
  if(tipo==="mes") {
    const hoje=new Date();
    filtroAtual={tipo:"personalizado",inicio:dataInput(new Date(hoje.getFullYear(),hoje.getMonth(),1)),fim:dataInput(hoje),rotulo:"mês atual"};
  } else {
    const rotulos={"24h":"24 h","7d":"7 dias","30d":"30 dias"};
    filtroAtual={tipo:"periodo",valor:tipo,rotulo:rotulos[tipo]};
  }
  await carregarHistoricoEResumo();
}

function aplicarTema(tema, persistir=true) {
  document.documentElement.dataset.theme=tema;
  if(persistir) localStorage.setItem("ea-theme",tema);
  const escuro=tema==="dark";
  $("#theme-icon").textContent=escuro?"☀":"☾";
  $("#theme-text").textContent=escuro?"Claro":"Escuro";
  if(ultimoHistorico) renderHistorico(ultimoHistorico);
}

function atualizarContador() {
  const el = $("#auto-refresh-info");
  if (!el) return;
  el.textContent = atualizandoAgora ? "Atualizando..." : `Próxima atualização em ${segundosParaAtualizar} s`;
}

async function atualizarAgoraAutomaticamente() {
  if (atualizandoAgora) return;
  atualizandoAgora = true;
  atualizarContador();
  try { await carregarAgora(); segundosParaAtualizar = INTERVALO_AGORA_S; }
  catch (erro) { console.error("[auto/agora]", erro); segundosParaAtualizar = INTERVALO_AGORA_S; }
  finally { atualizandoAgora = false; atualizarContador(); }
}

async function atualizarHistoricoAutomaticamente() {
  if (atualizandoHistorico) return;
  atualizandoHistorico = true;
  try { await carregarHistoricoEResumo(); }
  catch (erro) { console.error("[auto/historico]", erro); }
  finally { atualizandoHistorico = false; }
}

function iniciarAtualizacaoAutomatica() {
  atualizarContador();
  setInterval(() => {
    if (document.hidden) return;
    segundosParaAtualizar -= 1;
    if (segundosParaAtualizar <= 0) { segundosParaAtualizar = INTERVALO_AGORA_S; atualizarAgoraAutomaticamente(); }
    else atualizarContador();
  }, 1000);
  setInterval(() => { if (!document.hidden) atualizarHistoricoAutomaticamente(); }, INTERVALO_HISTORICO_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { segundosParaAtualizar = INTERVALO_AGORA_S; atualizarAgoraAutomaticamente(); atualizarHistoricoAutomaticamente(); }
  });
}

$("#theme-toggle").addEventListener("click",()=>aplicarTema(document.documentElement.dataset.theme==="dark"?"light":"dark"));
$("#atualizar-agora").addEventListener("click", async () => {
  const b = $("#atualizar-agora");
  b.disabled = true; atualizandoAgora = true; atualizarContador();
  try { await carregarAgora(); segundosParaAtualizar = INTERVALO_AGORA_S; }
  finally { atualizandoAgora = false; b.disabled = false; atualizarContador(); }
});
$$(".period-button").forEach(b=>b.addEventListener("click",()=>selecionarPeriodo(b.dataset.periodo)));
$("#serie-estacao").addEventListener("change",aplicarVisibilidadeGlobal);
$("#serie-openmeteo").addEventListener("change",aplicarVisibilidadeGlobal);
$("#aplicar-periodo").addEventListener("click",async()=>{
  const inicio=$("#data-inicio").value, fim=$("#data-fim").value, erro=$("#erro-periodo"); erro.textContent="";
  if(!inicio||!fim){erro.textContent="Informe as duas datas.";return;}
  const a=new Date(`${inicio}T00:00:00`), b=new Date(`${fim}T23:59:59`);
  if(a>b){erro.textContent="A data inicial deve ser anterior à final.";return;}
  if((b-a)/86400000>365){erro.textContent="O período máximo é de 365 dias.";return;}
  filtroAtual={tipo:"personalizado",inicio,fim,rotulo:`${a.toLocaleDateString("pt-BR")} a ${b.toLocaleDateString("pt-BR")}`};
  await carregarHistoricoEResumo();
});

async function iniciar() {
  configurarInfos();
  definirInputsPadrao();
  aplicarTema(document.documentElement.dataset.theme||"light",false);
  try { await Promise.all([carregarAgora(),carregarHistoricoEResumo()]); }
  catch(erro){ console.error("[dashboard]",erro); }
  iniciarAtualizacaoAutomatica();
}
iniciar();
