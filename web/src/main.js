import "./style.css";
import Chart from "chart.js/auto";

let filtroAtual = { tipo: "periodo", valor: "24h", rotulo: "24 h" };
let ultimoHistorico = null;
const charts = {};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

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

function setConexao(status) {
  const dot = $("#connection-dot");
  const texto = $("#connection-text");
  dot.className = "dot";
  if (status === "online") { dot.classList.add("online"); texto.textContent = "estação online"; }
  else if (status === "atraso") { dot.classList.add("delay"); texto.textContent = "estação com atraso"; }
  else { dot.classList.add("offline"); texto.textContent = "estação offline"; }
}

function card(rotulo, valor) {
  return `<article class="metric-card"><span>${rotulo}</span><strong>${valor}</strong></article>`;
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
  $("#ultima-leitura").textContent = `Última leitura: ${fmtDataHora(d.ultima_leitura)}`;
  $("#nome-estacao").textContent = `Estação: ${d.nome_estacao || d.estacao || "—"}`;
  $("#json-agora").textContent = JSON.stringify(d, null, 2);
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
    $("#json-agora").textContent = String(erro);
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
  $("#json-resumo").textContent=JSON.stringify(r,null,2);
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

$("#theme-toggle").addEventListener("click",()=>aplicarTema(document.documentElement.dataset.theme==="dark"?"light":"dark"));
$("#atualizar-agora").addEventListener("click",async()=>{ const b=$("#atualizar-agora"); b.disabled=true; try{await carregarAgora();}finally{b.disabled=false;} });
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
  definirInputsPadrao();
  aplicarTema(document.documentElement.dataset.theme||"light",false);
  try { await Promise.all([carregarAgora(),carregarHistoricoEResumo()]); }
  catch(erro){ console.error("[dashboard]",erro); }
}
iniciar();
