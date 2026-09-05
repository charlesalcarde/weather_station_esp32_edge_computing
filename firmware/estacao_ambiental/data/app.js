const $=id=>document.getElementById(id);

let dados={};
let externo={};
let historico=[];
let eventos=[];

let unidadeTemp="C";
let unidadePressao="hPa";

let wifiStatus={};
let wifiPollTimer=null;
let identidade={};

let temaAtual="light";

let relogioBase=null;
let relogioRecebidoEm=0;

// ==========================================================
// CONVERSÕES
// ==========================================================

const convTemp=v=>unidadeTemp==="F"?v*9/5+32:v;
const convPres=v=>unidadePressao==="atm"?v/1013.25:v;

function fmtTemp(v){
  return convTemp(v).toFixed(1)+(unidadeTemp==="C"?" °C":" °F");
}

function fmtDeltaTemp(v){
  return unidadeTemp==="F"
    ? (v*9/5).toFixed(1)+" °F"
    : v.toFixed(1)+" °C";
}

function fmtPres(v){
  return unidadePressao==="atm"
    ? convPres(v).toFixed(4)+" atm"
    : v.toFixed(1)+" hPa";
}

function fmtDeltaPres(v){
  return unidadePressao==="atm"
    ? (v/1013.25).toFixed(5)+" atm"
    : v.toFixed(1)+" hPa";
}

function fmtTendencia(v){
  return unidadePressao==="atm"
    ? (v/1013.25).toFixed(5)+" atm/h"
    : v.toFixed(2)+" hPa/h";
}

// ==========================================================
// TEMA CLARO / ESCURO
// ==========================================================

function aplicarTema(tema){
  temaAtual=
    tema==="dark"
    ? "dark"
    : "light";

  document.documentElement.setAttribute(
    "data-theme",
    temaAtual
  );

  $("btnTema").textContent=
    temaAtual==="dark"
    ? "☀"
    : "☾";

  $("btnTema").title=
    temaAtual==="dark"
    ? "Usar modo claro"
    : "Usar modo escuro";

  localStorage.setItem(
    "estacaoTema",
    temaAtual
  );

  desenharGraficos();
}

function inicializarTema(){
  const salvo=
    localStorage.getItem(
      "estacaoTema"
    );

  if(
    salvo==="dark" ||
    salvo==="light"
  ){
    aplicarTema(
      salvo
    );
    return;
  }

  const prefereEscuro=
    window.matchMedia &&
    window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

  aplicarTema(
    prefereEscuro
    ? "dark"
    : "light"
  );
}

$("btnTema").onclick=()=>{
  aplicarTema(
    temaAtual==="dark"
    ? "light"
    : "dark"
  );
};

// ==========================================================
// RELÓGIO
// ==========================================================

function sincronizarRelogio(){
  if(!dados.dataISO||!dados.horaAtual)return;

  const [y,m,d]=dados.dataISO.split("-").map(Number);
  const [h,mi,s]=dados.horaAtual.split(":").map(Number);

  relogioBase=Date.UTC(y,m-1,d,h,mi,s);
  relogioRecebidoEm=Date.now();

  desenharRelogio();
}

function desenharRelogio(){
  if(relogioBase===null)return;

  const agora=new Date(
    relogioBase+
    (Date.now()-relogioRecebidoEm)
  );

  const pad=n=>String(n).padStart(2,"0");

  const data=
    pad(agora.getUTCDate())+"/"+
    pad(agora.getUTCMonth()+1)+"/"+
    agora.getUTCFullYear();

  const hora=
    pad(agora.getUTCHours())+":"+
    pad(agora.getUTCMinutes())+":"+
    pad(agora.getUTCSeconds());

  $("dataEstacao").textContent=data;
  $("relogioEstacao").textContent=hora;
  $("horaRodape").textContent=hora;
}

setInterval(desenharRelogio,1000);

// ==========================================================
// TEMPO METEOROLÓGICO
// ==========================================================

function descricaoTempo(codigo,isDay){
  const dia=isDay!==0;

  if(codigo===0)return{icon:dia?"☀️":"🌙",text:"Céu limpo"};
  if(codigo===1)return{icon:dia?"🌤️":"🌙",text:"Predominantemente limpo"};
  if(codigo===2)return{icon:"⛅",text:"Parcialmente nublado"};
  if(codigo===3)return{icon:"☁️",text:"Nublado"};
  if(codigo===45||codigo===48)return{icon:"🌫️",text:"Neblina"};

  if([51,53,55,56,57].includes(codigo))
    return{icon:"🌦️",text:"Chuvisco"};

  if([61,63,65,66,67].includes(codigo))
    return{icon:"🌧️",text:"Chuva"};

  if([71,73,75,77].includes(codigo))
    return{icon:"❄️",text:"Neve"};

  if([80,81,82].includes(codigo))
    return{icon:"🌧️",text:"Pancadas de chuva"};

  if([85,86].includes(codigo))
    return{icon:"🌨️",text:"Pancadas de neve"};

  if([95,96,99].includes(codigo))
    return{icon:"⛈️",text:"Tempestade"};

  return{icon:"🌐",text:"Condição não identificada"};
}

// ==========================================================
// APRESENTAÇÃO DE TEXTOS DO FIRMWARE
//
// IMPORTANTE:
// Os códigos internos NÃO são modificados.
//
// Exemplos:
// ESTAVEL     -> ESTÁVEL
// ATENCAO     -> ATENÇÃO
// CONFORTAVEL -> CONFORTÁVEL
//
// Isso preserva o contrato Firmware -> Dashboard -> Cloud.
// ==========================================================

function textoApresentacao(valor){
  if(valor===null||valor===undefined)return "";

  const original=String(valor).trim();

  const substituicoes=[
    [/\bATENCAO\b/gi,"ATENÇÃO"],
    [/\bESTAVEL\b/gi,"ESTÁVEL"],
    [/\bINSTAVEL\b/gi,"INSTÁVEL"],
    [/\bCONFORTAVEL\b/gi,"CONFORTÁVEL"],
    [/\bDESCONFORTAVEL\b/gi,"DESCONFORTÁVEL"],
    [/\bACEITAVEL\b/gi,"ACEITÁVEL"],
    [/\bPRESSAO\b/gi,"PRESSÃO"],
    [/\bCONDICAO\b/gi,"CONDIÇÃO"],
    [/\bTENDENCIA\b/gi,"TENDÊNCIA"],
    [/\bMAXIMA\b/gi,"MÁXIMA"],
    [/\bMINIMA\b/gi,"MÍNIMA"],
    [/\bUMIDO\b/gi,"ÚMIDO"],
    [/\bUMIDA\b/gi,"ÚMIDA"],
    [/\bCRITICO\b/gi,"CRÍTICO"],
    [/\bCRITICA\b/gi,"CRÍTICA"],
    [/\bANOMALO\b/gi,"ANÔMALO"],
    [/\bANOMALA\b/gi,"ANÔMALA"]
  ];

  let texto=original;

  substituicoes.forEach(([padrao,correcao])=>{
    texto=texto.replace(padrao,correcao);
  });

  // Melhora também a representação das transições.
  // Exemplo:
  // ESTAVEL -> ATENCAO
  // ESTÁVEL → ATENÇÃO
  texto=texto.replace(/\s*->\s*/g," → ");

  return texto;
}

// ==========================================================
// ESTADO AMBIENTAL
// ==========================================================

function aplicarEstado(elemento,texto,tipo){

  // A tradução ocorre somente neste ponto de apresentação.
  elemento.textContent=
    textoApresentacao(texto)||"--";

  elemento.classList.remove(
    "good",
    "warn",
    "bad",
    "neutral"
  );

  elemento.classList.add(tipo);
}

function desenharEstado(){

  // IMPORTANTE:
  // As comparações continuam utilizando os códigos originais.
  // Portanto nenhuma lógica Edge é alterada.

  let geralTipo=
    dados.estadoGeral==="ESTAVEL"
    ? "good"
    : dados.estadoGeral==="ATENCAO"
    ? "warn"
    : dados.estadoGeral==="ALERTA"
    ? "bad"
    : "neutral";

  aplicarEstado(
    $("estadoGeral"),
    dados.estadoGeral,
    geralTipo
  );

  let umiTipo=
    dados.estadoUmidade==="FAIXA MODERADA"
    ? "good"
    : (dados.estadoUmidade||"").includes("MUITO")
    ? "bad"
    : "warn";

  aplicarEstado(
    $("estadoUmidade"),
    dados.estadoUmidade,
    umiTipo
  );

  aplicarEstado(
    $("estadoConforto"),
    dados.estadoConforto,
    dados.estadoConforto==="CONFORTAVEL"
    ? "good"
    : dados.estadoConforto==="ACEITAVEL"
    ? "neutral"
    : "warn"
  );

  $("pontoOrvalho").textContent=
    fmtTemp(dados.pontoOrvalho);

  aplicarEstado(
    $("estadoPressao"),
    dados.estadoPressao,
    dados.estadoPressao==="ESTAVEL"
    ? "good"
    : dados.estadoPressao==="EM QUEDA"
    ? "warn"
    : "neutral"
  );

  $("tendenciaValor").textContent=
    fmtTendencia(dados.tendenciaHora);

  aplicarEstado(
    $("instabilidade"),
    dados.instabilidade,
    dados.instabilidade==="BAIXA"
    ? "good"
    : dados.instabilidade==="MODERADA"
    ? "warn"
    : dados.instabilidade==="ELEVADA"
    ? "bad"
    : "neutral"
  );

  aplicarEstado(
    $("anomalia"),
    dados.anomalia,
    dados.anomalia==="NENHUMA"
    ? "good"
    : "bad"
  );

  desenharAlertas();
}

// ==========================================================
// ALERTAS
// ==========================================================

function desenharAlertas(){
  const box=$("alertas");
  box.innerHTML="";

  if(!dados.numeroAlertas){
    box.innerHTML=
      '<div class="alert-chip no-alert">Nenhum alerta ativo</div>';
    return;
  }

  for(let i=1;i<=4;i++){
    const texto=dados["alerta"+i];

    if(texto){
      const item=document.createElement("div");
      item.className="alert-chip";

      // Corrige somente a apresentação.
      item.textContent=
        textoApresentacao(texto);

      box.appendChild(item);
    }
  }
}

// ==========================================================
// CARDS
// ==========================================================

function desenharCards(){
  if(dados.tempBMP===undefined)return;

  $("tempBMP").textContent=fmtTemp(dados.tempBMP);
  $("bmp15").textContent=fmtTemp(dados.tempBMP15);
  $("bmpMin").textContent=fmtTemp(dados.tempBMPMin);
  $("bmpMax").textContent=fmtTemp(dados.tempBMPMax);
  $("bmpMinHora").textContent=dados.horaTempBMPMin;
  $("bmpMaxHora").textContent=dados.horaTempBMPMax;

  $("tempDHT").textContent=fmtTemp(dados.tempDHT);
  $("dht15").textContent=fmtTemp(dados.tempDHT15);
  $("dhtMin").textContent=fmtTemp(dados.tempDHTMin);
  $("dhtMax").textContent=fmtTemp(dados.tempDHTMax);
  $("dhtMinHora").textContent=dados.horaTempDHTMin;
  $("dhtMaxHora").textContent=dados.horaTempDHTMax;
  $("difTemp").textContent=fmtDeltaTemp(dados.diferenca);

  $("umi").textContent=dados.umidade.toFixed(1)+" %";
  $("umi15").textContent=dados.umidade15.toFixed(1)+" %";
  $("umiMin").textContent=dados.umidadeMin.toFixed(1)+" %";
  $("umiMax").textContent=dados.umidadeMax.toFixed(1)+" %";
  $("umiMinHora").textContent=dados.horaUmidadeMin;
  $("umiMaxHora").textContent=dados.horaUmidadeMax;

  $("pres").textContent=fmtPres(dados.pressaoMar);
  $("presLocal").textContent=fmtPres(dados.pressaoLocal);
  $("pres15").textContent=fmtPres(dados.pressao15);
  $("pres60").textContent=fmtPres(dados.pressao60);
  $("presMin").textContent=fmtPres(dados.pressaoMin);
  $("presMax").textContent=fmtPres(dados.pressaoMax);
  $("presMinHora").textContent=dados.horaPressaoMin;
  $("presMaxHora").textContent=dados.horaPressaoMax;
  $("variacao").textContent=fmtDeltaPres(dados.variacao);

  $("amostras").textContent=dados.amostras;
  $("ultima").textContent=dados.ultimaLeitura;

  $("altitudeEstacao").textContent=
    Number(dados.altitude).toFixed(1)+" m";

  $("origemAltitudeRodape").textContent=
    dados.origemAltitude||"--";

  atualizarWifi(dados.rssi);
  desenharEstado();
}

// ==========================================================
// EXTERNO
// ==========================================================

function desenharExterno(){
  if(!externo)return;

  $("externalLocation").textContent=
    externo.local||"--";

  $("externalLocalFooter").textContent=
    externo.local||"--";

  $("externalSource").textContent=
    externo.fonte||"--";

  $("externalTime").textContent=
    externo.atualizado||"--";

  $("externalElevation").textContent=
    externo.altitude!==undefined
    ? Number(externo.altitude).toFixed(1)+" m"
    : "--";

  if(!externo.temDados){
    $("weatherIcon").textContent="🌐";
    $("externalCondition").textContent="Aguardando dados...";
    $("apiStatus").textContent="Fonte externa ainda sem dados válidos";
    return;
  }

  const c=
    descricaoTempo(
      externo.weatherCode,
      externo.isDay
    );

  $("weatherIcon").textContent=c.icon;
  $("externalCondition").textContent=c.text;

  if(externo.disponivel){
    $("apiStatus").textContent=
      "● Fonte externa atualizada";
    $("apiStatus").style.color="#247345";
  }else{
    $("apiStatus").textContent=
      "● Sem conexão — exibindo últimos dados válidos";
    $("apiStatus").style.color="#9a3535";
  }

  $("extTemp").textContent=
    fmtTemp(externo.temperatura);

  $("extSensacao").textContent=
    fmtTemp(externo.sensacao);

  $("extUmidade").textContent=
    externo.umidade.toFixed(0)+" %";

  $("extOrvalho").textContent=
    fmtTemp(externo.orvalho);

  $("extPressaoMar").textContent=
    fmtPres(externo.pressaoMar);

  $("extPressaoSup").textContent=
    fmtPres(externo.pressaoSuperficie);

  $("extNuvens").textContent=
    externo.nuvens.toFixed(0)+" %";

  $("extVisibilidade").textContent=
    (externo.visibilidade/1000).toFixed(1)+" km";

  $("extVento").textContent=
    externo.vento.toFixed(1)+" km/h";

  $("extDirecao").textContent=
    externo.direcaoCardeal+
    " ("+
    externo.direcaoVento.toFixed(0)+
    "°)";

  $("extRajada").textContent=
    externo.rajada.toFixed(1)+" km/h";

  $("extUV").textContent=
    externo.uv.toFixed(1);

  $("extPrecip").textContent=
    externo.precipitacao.toFixed(1)+" mm";

  $("extChuva").textContent=
    externo.chuva.toFixed(1)+" mm";

  $("extProb").textContent=
    externo.probChuva.toFixed(0)+" %";

  desenharComparacao();
}

function desenharComparacao(){
  if(
    !externo.temDados ||
    dados.tempDHT===undefined
  ) return;

  $("cmpTempLocal").textContent=
    fmtTemp(dados.tempDHT);

  $("cmpTempExt").textContent=
    fmtTemp(externo.temperatura);

  $("cmpTempDelta").textContent=
    fmtDeltaTemp(
      dados.tempDHT -
      externo.temperatura
    );

  $("cmpUmiLocal").textContent=
    dados.umidade.toFixed(0)+" %";

  $("cmpUmiExt").textContent=
    externo.umidade.toFixed(0)+" %";

  const du=
    dados.umidade -
    externo.umidade;

  $("cmpUmiDelta").textContent=
    (du>=0?"+":"")+
    du.toFixed(0)+
    " %";

  $("cmpPresLocal").textContent=
    fmtPres(dados.pressaoMar);

  $("cmpPresExt").textContent=
    fmtPres(externo.pressaoMar);

  $("cmpPresDelta").textContent=
    fmtDeltaPres(
      dados.pressaoMar -
      externo.pressaoMar
    );

  $("cmpOrvLocal").textContent=
    fmtTemp(dados.pontoOrvalho);

  $("cmpOrvExt").textContent=
    fmtTemp(externo.orvalho);

  $("cmpOrvDelta").textContent=
    fmtDeltaTemp(
      dados.pontoOrvalho -
      externo.orvalho
    );
}

// ==========================================================
// EVENTOS
// ==========================================================

function desenharEventos(){
  const box=$("listaEventos");
  box.innerHTML="";

  if(!eventos.length){
    box.innerHTML=
      '<div class="muted event-empty">Nenhum evento registrado.</div>';
    return;
  }

  eventos.slice(0,10).forEach(evento=>{
    const row=document.createElement("div");
    row.className="event-row";

    const hora=document.createElement("div");
    hora.className="event-time";
    hora.textContent=evento.hora;

    const tipo=document.createElement("div");
    tipo.className="event-type";

    // Ex.: PRESSAO -> PRESSÃO
    tipo.textContent=
      textoApresentacao(evento.tipo);

    const mensagem=document.createElement("div");

    // Ex.:
    // "Condicao geral: ESTAVEL -> ATENCAO"
    // torna-se:
    // "Condição geral: ESTÁVEL → ATENÇÃO"
    mensagem.textContent=
      textoApresentacao(evento.mensagem);

    row.append(
      hora,
      tipo,
      mensagem
    );

    box.appendChild(row);
  });
}

// ==========================================================
// WI-FI
// ==========================================================

function atualizarWifi(rssi){
  let qualidade;
  let barras;

  if(rssi>=-50){
    qualidade="Excelente";
    barras=5;
  }else if(rssi>=-60){
    qualidade="Muito bom";
    barras=4;
  }else if(rssi>=-70){
    qualidade="Bom";
    barras=3;
  }else if(rssi>=-80){
    qualidade="Regular";
    barras=2;
  }else{
    qualidade="Fraco";
    barras=1;
  }

  $("wifi").textContent=
    rssi+
    " dBm • "+
    qualidade;

  for(let i=1;i<=5;i++){
    $("b"+i)
      .classList
      .toggle(
        "on",
        i<=barras
      );
  }
}

// ==========================================================
// GRÁFICOS
// ==========================================================

function desenharGrafico(
  canvasId,
  tipId,
  series,
  unidade
){
  const canvas=$(canvasId);
  const ctx=canvas.getContext("2d");
  const rect=canvas.getBoundingClientRect();
  const dpr=window.devicePixelRatio||1;

  canvas.width=rect.width*dpr;
  canvas.height=rect.height*dpr;

  ctx.setTransform(
    dpr,0,0,dpr,0,0
  );

  const W=rect.width;
  const H=rect.height;

  ctx.clearRect(0,0,W,H);

  if(historico.length<2){
    const escuro=
      document.documentElement.getAttribute(
        "data-theme"
      )==="dark";

    ctx.fillStyle=
      escuro
      ? "#8fa3af"
      : "#82919c";

    ctx.font="13px Arial";
    ctx.fillText(
      "Aguardando histórico...",
      20,
      35
    );
    return;
  }

  const margem={
    left:58,
    right:18,
    top:18,
    bottom:35
  };

  const largura=
    W-
    margem.left-
    margem.right;

  const altura=
    H-
    margem.top-
    margem.bottom;

  let valores=[];

  series.forEach(s=>{
    historico.forEach(p=>{
      const v=s.valor(p);

      if(Number.isFinite(v))
        valores.push(v);
    });
  });

  let minimo=Math.min(...valores);
  let maximo=Math.max(...valores);
  let faixa=maximo-minimo;

  if(faixa<0.01)
    faixa=1;

  minimo-=faixa*0.15;
  maximo+=faixa*0.15;

  const escuro=
    document.documentElement.getAttribute(
      "data-theme"
    )==="dark";

  ctx.strokeStyle=
    escuro
    ? "#30404a"
    : "#e8edf1";

  ctx.fillStyle=
    escuro
    ? "#8fa3af"
    : "#82919c";

  ctx.lineWidth=1;
  ctx.font="11px Arial";

  for(let i=0;i<=4;i++){
    const y=
      margem.top+
      altura*i/4;

    ctx.beginPath();
    ctx.moveTo(
      margem.left,
      y
    );
    ctx.lineTo(
      W-margem.right,
      y
    );
    ctx.stroke();

    const valor=
      maximo-
      (maximo-minimo)*i/4;

    ctx.fillText(
      valor.toFixed(
        unidade==="atm"
        ? 4
        : 1
      ),
      5,
      y+4
    );
  }

  const ticks=
    Math.min(
      5,
      historico.length
    );

  for(let i=0;i<ticks;i++){
    const pos=
      Math.round(
        i*
        (historico.length-1)/
        (ticks-1)
      );

    const x=
      margem.left+
      largura*
      pos/
      (historico.length-1);

    ctx.fillText(
      historico[pos].hora,
      x-15,
      H-10
    );
  }

  series.forEach(s=>{
    ctx.strokeStyle=s.cor;

    ctx.lineWidth=
      s.tracejado
      ? 2.4
      : 1.8;

    ctx.setLineDash(
      s.tracejado
      ? [8,5]
      : []
    );

    ctx.beginPath();

    historico.forEach((p,i)=>{
      const valor=s.valor(p);

      const x=
        margem.left+
        largura*i/
        (historico.length-1);

      const y=
        margem.top+
        altura*
        (maximo-valor)/
        (maximo-minimo);

      if(i===0)
        ctx.moveTo(x,y);
      else
        ctx.lineTo(x,y);
    });

    ctx.stroke();
    ctx.setLineDash([]);
  });

  canvas._grafico={
    margem,
    largura,
    series,
    tipId
  };
}

function desenharGraficos(){
  desenharGrafico(
    "grafTemp",
    "tipTemp",
    [
      {
        label:"BMP180",
        cor:"#1769aa",
        valor:p=>convTemp(p.bmp),
        formato:v=>
          v.toFixed(1)+
          (unidadeTemp==="C"?" °C":" °F")
      },
      {
        label:"BMP180 média 15 min",
        cor:"#6fa8dc",
        tracejado:true,
        valor:p=>convTemp(p.bmp15),
        formato:v=>
          v.toFixed(1)+
          (unidadeTemp==="C"?" °C":" °F")
      },
      {
        label:"DHT11",
        cor:"#e67e22",
        valor:p=>convTemp(p.dht),
        formato:v=>
          v.toFixed(1)+
          (unidadeTemp==="C"?" °C":" °F")
      },
      {
        label:"DHT11 média 15 min",
        cor:"#efad69",
        tracejado:true,
        valor:p=>convTemp(p.dht15),
        formato:v=>
          v.toFixed(1)+
          (unidadeTemp==="C"?" °C":" °F")
      }
    ],
    unidadeTemp
  );

  desenharGrafico(
    "grafPressao",
    "tipPressao",
    [
      {
        label:"Pressão",
        cor:"#775ac4",
        valor:p=>convPres(p.pressao),
        formato:v=>
          unidadePressao==="atm"
          ? v.toFixed(4)+" atm"
          : v.toFixed(1)+" hPa"
      },
      {
        label:"Média 15 min",
        cor:"#b4a0df",
        tracejado:true,
        valor:p=>convPres(p.pressao15),
        formato:v=>
          unidadePressao==="atm"
          ? v.toFixed(4)+" atm"
          : v.toFixed(1)+" hPa"
      }
    ],
    unidadePressao
  );

  desenharGrafico(
    "grafUmidade",
    "tipUmidade",
    [
      {
        label:"Umidade",
        cor:"#159895",
        valor:p=>p.umidade,
        formato:v=>v.toFixed(1)+" %"
      },
      {
        label:"Média 15 min",
        cor:"#78c5c2",
        tracejado:true,
        valor:p=>p.umidade15,
        formato:v=>v.toFixed(1)+" %"
      }
    ],
    "%"
  );
}

// ==========================================================
// TOOLTIPS DOS GRÁFICOS
// ==========================================================

function ativarTooltip(id){
  const canvas=$(id);

  function mostrar(cx,cy){
    if(
      !canvas._grafico ||
      historico.length<2
    ) return;

    const g=canvas._grafico;
    const rect=canvas.getBoundingClientRect();

    let p=
      (
        cx-
        rect.left-
        g.margem.left
      )/
      g.largura;

    p=Math.max(
      0,
      Math.min(
        1,
        p
      )
    );

    const idx=
      Math.round(
        p*
        (historico.length-1)
      );

    const ponto=
      historico[idx];

    const tip=
      $(g.tipId);

    let html=
      "<strong>"+
      ponto.hora+
      "</strong><br>";

    g.series.forEach(s=>{
      html+=
        s.label+
        ": <strong>"+
        s.formato(
          s.valor(ponto)
        )+
        "</strong><br>";
    });

    tip.innerHTML=html;

    const card=
      canvas.closest(
        ".chart-card"
      );

    const cardRect=
      card.getBoundingClientRect();

    tip.style.left=
      Math.max(
        10,
        Math.min(
          cx-
          cardRect.left+
          12,
          cardRect.width-
          180
        )
      )+
      "px";

    tip.style.top=
      Math.max(
        10,
        cy-
        cardRect.top-
        10
      )+
      "px";

    tip.style.display="block";
  }

  canvas.addEventListener(
    "mousemove",
    e=>
      mostrar(
        e.clientX,
        e.clientY
      )
  );

  canvas.addEventListener(
    "mouseleave",
    ()=>{
      if(canvas._grafico)
        $(canvas._grafico.tipId)
          .style
          .display=
          "none";
    }
  );

  canvas.addEventListener(
    "touchstart",
    e=>{
      if(e.touches.length)
        mostrar(
          e.touches[0].clientX,
          e.touches[0].clientY
        );
    },
    {passive:true}
  );
}

// ==========================================================
// MODAIS
// ==========================================================

const infoMap={
  umidade:[
    "Umidade relativa",
    "Classificação local da umidade medida pelo DHT11. Condições previstas: AR MUITO SECO · AR SECO · FAIXA MODERADA · UMIDADE ELEVADA · UMIDADE MUITO ALTA."
  ],
  conforto:[
    "Conforto ambiental",
    "Combina temperatura e umidade. Condições previstas: FRIO · CONFORTÁVEL · ACEITÁVEL · QUENTE · FORA DA FAIXA IDEAL."
  ],
  orvalho:[
    "Ponto de orvalho",
    "Temperatura estimada na qual o ar atingiria saturação. Valor calculado localmente pelo ESP32."
  ],
  pressao:[
    "Tendência barométrica",
    "Calculada por regressão linear. Condições previstas: FORMANDO HISTÓRICO · SUBINDO · ESTÁVEL · EM QUEDA."
  ],
  instabilidade:[
    "Possível instabilidade",
    "Indicador experimental baseado em pressão, umidade e temperatura. Condições previstas: AGUARDANDO HISTÓRICO · BAIXA · MODERADA · ELEVADA."
  ],
  anomalia:[
    "Detecção de anomalias",
    "Procura comportamento incomum nas medições. Condições previstas: NENHUMA · DETECTADA."
  ],
  alertas:[
    "Alertas locais",
    "Alertas previstos: UMIDADE MUITO BAIXA · UMIDADE MUITO ELEVADA · PRESSÃO ATMOSFÉRICA EM QUEDA · POSSÍVEL AUMENTO DE INSTABILIDADE · COMPORTAMENTO ANÔMALO DETECTADO."
  ],
  externo:[
    "Referência meteorológica externa",
    "Dados obtidos pela Internet através da fonte indicada no quadro. O local pode ser configurado. Esses dados não são medições feitas pelo BMP180 ou DHT11."
  ]
};

function abrirInfo(chave){
  const info=infoMap[chave];
  if(!info)return;

  $("modalTitle").textContent=
    info[0];

  $("modalBody").textContent=
    info[1];

  $("modalOverlay")
    .classList
    .add("open");
}

function fecharInfo(){
  $("modalOverlay")
    .classList
    .remove("open");
}

document
  .querySelectorAll(".info-btn")
  .forEach(btn=>{
    btn.addEventListener(
      "click",
      ()=>
        abrirInfo(
          btn.dataset.info
        )
    );
  });

$("modalClose").onclick=
  fecharInfo;

$("modalOverlay").onclick=
  e=>{
    if(e.target===$("modalOverlay"))
      fecharInfo();
  };

// ==========================================================
// CONFIGURAÇÕES
// ==========================================================

function abrirConfiguracoes(aba="identidade"){
  $("settingsOverlay").classList.add("open");
  selecionarAbaConfiguracoes(aba);
  carregarIdentidade();
  carregarStatusWiFi();
  atualizarResumoConfiguracoes();
}

function fecharConfiguracoes(){
  $("settingsOverlay").classList.remove("open");
}

function selecionarAbaConfiguracoes(aba){
  document.querySelectorAll(".settings-tab").forEach(btn=>{
    btn.classList.toggle(
      "active",
      btn.dataset.settingsTab===aba
    );
  });

  document.querySelectorAll(".settings-section").forEach(sec=>{
    sec.classList.toggle(
      "active",
      sec.id==="settings-"+aba
    );
  });
}

async function carregarIdentidade(){
  try{
    const r=await fetch(
      "/identidade",
      {cache:"no-store"}
    );

    if(!r.ok)return;

    identidade=await r.json();

    $("nomeEstacaoInput").value=
      identidade.nomeEstacao||
      "Estacao Ambiental";

    $("hostnameInput").value=
      identidade.hostname||
      "estacao";

    $("hostnamePreview").textContent=
      identidade.enderecoLocal||
      "http://estacao.local";

  }catch(e){
    $("statusIdentidade").textContent=
      "Falha ao carregar identidade.";
  }
}

function hostnameClienteValido(host){
  return /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(host);
}

async function salvarIdentidadeUI(){
  const nome=
    $("nomeEstacaoInput")
      .value
      .trim();

  const host=
    $("hostnameInput")
      .value
      .trim()
      .toLowerCase();

  if(!nome){
    $("statusIdentidade").textContent=
      "Informe um nome para a estação.";
    return;
  }

  if(!hostnameClienteValido(host)){
    $("statusIdentidade").textContent=
      "Hostname inválido. Use letras minúsculas, números e hífen, sem espaços ou acentos.";
    return;
  }

  $("statusIdentidade").textContent=
    "Salvando...";

  try{
    const r=
      await fetch(
        "/salvarIdentidade",
        {
          method:"POST",
          headers:{
            "Content-Type":"application/json"
          },
          body:JSON.stringify({
            nomeEstacao:nome,
            hostname:host
          })
        }
      );

    const obj=await r.json();

    if(!r.ok)
      throw new Error(
        obj.erro||
        "Falha ao salvar identidade"
      );

    identidade=obj;

    $("hostnamePreview").textContent=
      obj.enderecoLocal;

    $("statusIdentidade").textContent=
      "Identidade salva. Acesso local: "+
      obj.enderecoLocal;

  }catch(e){
    $("statusIdentidade").textContent=
      "Falha: "+e.message;
  }
}

function atualizarResumoConfiguracoes(){
  if($("cfgLocalResumo")){
    const local=
      externo.local||"--";

    const alt=
      dados.altitude!==undefined
      ? Number(dados.altitude).toFixed(1)+" m"
      : "--";

    $("cfgLocalResumo").innerHTML=
      "<strong>Local atual:</strong> "+
      local+
      "<br><span class='coords'>Altitude: "+
      alt+
      " • Origem: "+
      (dados.origemAltitude||"--")+
      "</span>";
  }
}

$("btnConfiguracoes").onclick=
  ()=>abrirConfiguracoes();

$("settingsClose").onclick=
  fecharConfiguracoes;

$("settingsOverlay").onclick=
  e=>{
    if(e.target===$("settingsOverlay"))
      fecharConfiguracoes();
  };

document
  .querySelectorAll(".settings-tab")
  .forEach(btn=>{
    btn.onclick=
      ()=>selecionarAbaConfiguracoes(
        btn.dataset.settingsTab
      );
  });

$("hostnameInput").addEventListener(
  "input",
  ()=>{
    const host=
      $("hostnameInput")
        .value
        .trim()
        .toLowerCase();

    $("hostnamePreview").textContent=
      "http://"+
      (host||"estacao")+
      ".local";
  }
);

$("btnSalvarIdentidade").onclick=
  salvarIdentidadeUI;

$("btnAbrirWiFiAvancado").onclick=
  ()=>{
    fecharConfiguracoes();
    abrirWiFi();
  };

$("btnAbrirLocalAvancado").onclick=
  ()=>{
    fecharConfiguracoes();
    abrirConfig();
  };

// ==========================================================
// CONFIGURAÇÃO DE LOCAL
// ==========================================================

function abrirConfig(){
  const lat=
    externo.latitude!==undefined
    ? Number(externo.latitude).toFixed(5)
    : "--";

  const lon=
    externo.longitude!==undefined
    ? Number(externo.longitude).toFixed(5)
    : "--";

  $("localAtualConfig").innerHTML=
    "<strong>Local atual:</strong> "+
    (externo.local||"--")+
    "<br><span class='coords'>Latitude "+
    lat+
    " • Longitude "+
    lon+
    "</span>";

  $("altitudeConfigAtual").textContent=
    dados.altitude!==undefined
    ? Number(dados.altitude).toFixed(1)+" m"
    : "--";

  $("origemAltitudeConfig").textContent=
    "Origem: "+
    (dados.origemAltitude||"--");

  $("campoAltitude").value=
    dados.altitude!==undefined
    ? Number(dados.altitude).toFixed(1)
    : "";

  $("statusAltitude").textContent="";
  $("campoCidade").value="";
  $("statusBusca").textContent="";
  $("resultadosCidade").innerHTML="";

  $("configOverlay")
    .classList
    .add("open");
}

function fecharConfig(){
  $("configOverlay")
    .classList
    .remove("open");
}

$("configClose").onclick=
  fecharConfig;

$("configOverlay").onclick=
  e=>{
    if(e.target===$("configOverlay"))
      fecharConfig();
  };

async function buscarCidade(){
  const q=
    $("campoCidade")
      .value
      .trim();

  if(q.length<2){
    $("statusBusca").textContent=
      "Digite pelo menos dois caracteres.";
    return;
  }

  $("statusBusca").textContent=
    "Buscando...";

  $("resultadosCidade").innerHTML="";

  try{
    const r=
      await fetch(
        "/buscarLocal?q="+
        encodeURIComponent(q),
        {cache:"no-store"}
      );

    const obj=
      await r.json();

    if(!r.ok)
      throw new Error(
        obj.erro||
        "Erro na busca"
      );

    const lista=
      obj.resultados||
      [];

    if(!lista.length){
      $("statusBusca").textContent=
        "Nenhum local encontrado.";
      return;
    }

    $("statusBusca").textContent=
      "Selecione o local correto:";

    lista.forEach(local=>{
      const btn=
        document.createElement(
          "button"
        );

      btn.className=
        "location-result";

      btn.type=
        "button";

      const titulo=
        [
          local.nome,
          local.admin1,
          local.pais
        ]
        .filter(Boolean)
        .join(" • ");

      const nome=
        document.createElement(
          "strong"
        );

      nome.textContent=
        titulo;

      const coords=
        document.createElement(
          "span"
        );

      coords.className=
        "coords";

      coords.textContent=
        Number(local.lat).toFixed(5)+
        ", "+
        Number(local.lon).toFixed(5)+
        (
          local.elevation!==undefined
          ? " • elevação aproximada "+
            Number(local.elevation).toFixed(0)+
            " m"
          : ""
        );

      btn.append(
        nome,
        coords
      );

      btn.addEventListener(
        "click",
        ()=>salvarLocal(local)
      );

      $("resultadosCidade")
        .appendChild(btn);
    });

  }catch(e){
    $("statusBusca").textContent=
      "Falha: "+
      e.message;
  }
}

async function salvarLocal(local){
  $("statusBusca").textContent=
    "Salvando e atualizando meteorologia...";

  const params=
    new URLSearchParams({
      nome:local.nome||"",
      admin1:local.admin1||"",
      pais:local.pais||"",
      lat:String(local.lat),
      lon:String(local.lon),
      elevation:String(
        local.elevation!==undefined
        ? local.elevation
        : ""
      )
    });

  try{
    const r=
      await fetch(
        "/salvarLocal?"+
        params.toString(),
        {cache:"no-store"}
      );

    const obj=
      await r.json();

    if(!r.ok)
      throw new Error(
        obj.erro||
        "Falha ao salvar"
      );

    $("statusBusca").textContent=
      "Local salvo.";

    await carregar();

    setTimeout(
      fecharConfig,
      600
    );

  }catch(e){
    $("statusBusca").textContent=
      "Falha: "+
      e.message;
  }
}

$("btnBuscarCidade").onclick=
  buscarCidade;

$("campoCidade")
  .addEventListener(
    "keydown",
    e=>{
      if(e.key==="Enter")
        buscarCidade();
    }
  );

// ==========================================================
// ALTITUDE DA ESTAÇÃO
// ==========================================================

async function salvarAltitudeManual(){
  const valor=
    Number(
      $("campoAltitude").value
    );

  if(
    !Number.isFinite(valor) ||
    valor < -500 ||
    valor > 9000
  ){
    $("statusAltitude").textContent=
      "Informe uma altitude válida em metros.";
    return;
  }

  $("statusAltitude").textContent=
    "Salvando altitude manual...";

  try{
    const r=
      await fetch(
        "/salvarAltitude?valor="+
        encodeURIComponent(valor),
        {cache:"no-store"}
      );

    const obj=
      await r.json();

    if(!r.ok)
      throw new Error(
        obj.erro||
        "Falha ao salvar altitude"
      );

    $("statusAltitude").textContent=
      "Altitude manual salva.";

    await carregar();

    $("altitudeConfigAtual").textContent=
      Number(obj.altitude).toFixed(1)+" m";

    $("origemAltitudeConfig").textContent=
      "Origem: "+
      obj.origemAltitude;

  }catch(e){
    $("statusAltitude").textContent=
      "Falha: "+
      e.message;
  }
}

async function usarAltitudeAutomatica(){
  $("statusAltitude").textContent=
    "Consultando elevação do local...";

  try{
    const r=
      await fetch(
        "/altitudeAutomatica",
        {cache:"no-store"}
      );

    const obj=
      await r.json();

    if(!r.ok)
      throw new Error(
        obj.erro||
        "Falha ao obter altitude"
      );

    $("statusAltitude").textContent=
      "Altitude automática atualizada.";

    await carregar();

    $("campoAltitude").value=
      Number(obj.altitude).toFixed(1);

    $("altitudeConfigAtual").textContent=
      Number(obj.altitude).toFixed(1)+" m";

    $("origemAltitudeConfig").textContent=
      "Origem: "+
      obj.origemAltitude;

  }catch(e){
    $("statusAltitude").textContent=
      "Falha: "+
      e.message;
  }
}

$("btnSalvarAltitude").onclick=
  salvarAltitudeManual;

$("btnAltitudeAuto").onclick=
  usarAltitudeAutomatica;

// ==========================================================
// WI-FI CONFIGURÁVEL
// ==========================================================

function rssiDescricao(rssi){
  if(rssi>=-50)return "Excelente";
  if(rssi>=-60)return "Muito bom";
  if(rssi>=-70)return "Bom";
  if(rssi>=-80)return "Regular";
  return "Fraco";
}

async function carregarStatusWiFi(){
  try{
    const r=
      await fetch(
        "/wifiStatus",
        {cache:"no-store"}
      );

    if(!r.ok)return;

    wifiStatus=
      await r.json();

    atualizarInterfaceWiFi();

  }catch(e){
    console.log(
      "Status Wi-Fi:",
      e
    );
  }
}

function mapaRedesDisponiveis(){
  const mapa={};

  document
    .querySelectorAll(
      ".wifi-network"
    )
    .forEach(()=>{});

  return mapa;
}

function desenharRedesConhecidas(){
  const box=
    $("wifiKnownNetworks");

  box.innerHTML="";

  const conhecidas=
    wifiStatus.conhecidas||
    [];

  $("wifiKnownCount").textContent=
    (wifiStatus.totalConhecidas||0)+
    "/"+
    (wifiStatus.maxConhecidas||5);

  if(!conhecidas.length){
    box.innerHTML=
      '<div class="muted">Nenhuma rede conhecida ainda.</div>';
    return;
  }

  conhecidas
    .slice()
    .sort(
      (a,b)=>
        Number(b.ordem||0)-
        Number(a.ordem||0)
    )
    .forEach(rede=>{
      const item=
        document.createElement(
          "div"
        );

      item.className=
        "wifi-known-item";

      const info=
        document.createElement(
          "div"
        );

      info.className=
        "wifi-known-info";

      const nome=
        document.createElement(
          "div"
        );

      nome.className=
        "wifi-known-name";

      nome.textContent=
        rede.ssid;

      const meta=
        document.createElement(
          "div"
        );

      meta.className=
        "wifi-known-meta";

      meta.textContent=
        rede.conectada
        ? "Rede em uso nesta sessão"
        : "Rede salva na estação";

      info.append(
        nome,
        meta
      );

      const actions=
        document.createElement(
          "div"
        );

      actions.className=
        "wifi-known-actions";

      if(rede.conectada){
        const badge=
          document.createElement(
            "span"
          );

        badge.className=
          "wifi-connected-badge";

        badge.textContent=
          "Conectada";

        actions.appendChild(
          badge
        );
      }

      const remover=
        document.createElement(
          "button"
        );

      remover.type=
        "button";

      remover.className=
        "wifi-remove-button";

      remover.textContent=
        "Remover";

      remover.onclick=()=>{
        removerRedeConhecidaUI(
          rede.ssid
        );
      };

      actions.appendChild(
        remover
      );

      item.append(
        info,
        actions
      );

      box.appendChild(
        item
      );
    });
}

async function removerRedeConhecidaUI(ssid){
  if(
    !confirm(
      "Remover a rede conhecida '"+ssid+"'?"
    )
  ){
    return;
  }

  try{
    const r=
      await fetch(
        "/wifiRemove",
        {
          method:"POST",
          headers:{
            "Content-Type":
              "application/json"
          },
          body:JSON.stringify({
            ssid
          })
        }
      );

    const obj=
      await r.json();

    if(!r.ok){
      throw new Error(
        obj.erro||
        "Não foi possível remover a rede."
      );
    }

    $("wifiSaveStatus").textContent=
      obj.mensagem||
      "Rede removida.";

    $("wifiSaveStatus").className=
      "wifi-save-status ok";

    await carregarStatusWiFi();
    await escanearWiFi();

  }catch(e){
    $("wifiSaveStatus").textContent=
      "Falha: "+
      e.message;

    $("wifiSaveStatus").className=
      "wifi-save-status bad";
  }
}

function atualizarInterfaceWiFi(){
  desenharRedesConhecidas();

  const conectado=
    !!wifiStatus.conectado;

  $("wifiCfgEstado").textContent=
    conectado
    ? "Conectado"
    : "Sem rede";

  $("wifiCfgSSID").textContent=
    conectado
    ? (wifiStatus.ssidAtual||"--")
    : "--";

  $("wifiCfgIP").textContent=
    conectado
    ? (wifiStatus.ip||"--")
    : "--";

  $("wifiCfgRSSI").textContent=
    conectado
    ? wifiStatus.rssi+
      " dBm • "+
      rssiDescricao(
        wifiStatus.rssi
      )
    : "--";

  if($("cfgWifiEstado")){
    $("cfgWifiEstado").textContent=
      conectado
      ? "Conectado"
      : "Sem rede";

    $("cfgWifiSSID").textContent=
      conectado
      ? (wifiStatus.ssidAtual||"--")
      : "--";

    $("cfgWifiIP").textContent=
      conectado
      ? (wifiStatus.ip||"--")
      : "--";

    $("cfgWifiRSSI").textContent=
      conectado
      ? wifiStatus.rssi+
        " dBm • "+
        rssiDescricao(
          wifiStatus.rssi
        )
      : "--";

    if(wifiStatus.apAtivo){
      $("cfgWifiAP").classList.remove(
        "hidden"
      );

      $("cfgWifiAP").textContent=
        "Modo de recuperação ativo • "+
        wifiStatus.apSSID+
        " • "+
        wifiStatus.apIP;
    }else{
      $("cfgWifiAP").classList.add(
        "hidden"
      );
    }
  }

  const banner=
    $("wifiSetupBanner");

  if(wifiStatus.apAtivo){
    banner.classList.remove(
      "hidden"
    );

    $("wifiSetupBannerText").textContent=
      "Rede de configuração: "+
      wifiStatus.apSSID+
      " • IP: "+
      wifiStatus.apIP+
      ".";
  }else{
    banner.classList.add(
      "hidden"
    );
  }

  const apNote=
    $("wifiCfgAP");

  if(wifiStatus.apAtivo){
    apNote.classList.remove(
      "hidden"
    );

    apNote.textContent=
      "Modo de recuperação ativo • "+
      wifiStatus.apSSID+
      " • "+
      wifiStatus.apIP;
  }else{
    apNote.classList.add(
      "hidden"
    );
  }

  if(wifiStatus.trocaMensagem){
    $("wifiSaveStatus").textContent=
      wifiStatus.trocaMensagem;

    $("wifiSaveStatus").className=
      "wifi-save-status "+
      (
        wifiStatus.trocaEstado==="SUCESSO"
        ? "ok"
        : wifiStatus.trocaEstado==="FALHA"
        ? "bad"
        : "warn"
      );
  }
}

function abrirWiFi(){
  $("wifiOverlay")
    .classList
    .add("open");

  $("wifiScanStatus").textContent="";
  $("wifiNetworks").innerHTML="";
  $("wifiSaveStatus").textContent="";

  carregarStatusWiFi();
  escanearWiFi();
}

function fecharWiFi(){
  $("wifiOverlay")
    .classList
    .remove("open");
}

async function escanearWiFi(){
  $("wifiScanStatus").textContent=
    "Procurando redes próximas...";

  $("wifiNetworks").innerHTML="";

  try{
    const r=
      await fetch(
        "/wifiScan",
        {cache:"no-store"}
      );

    const obj=
      await r.json();

    if(!r.ok)
      throw new Error(
        obj.erro||
        "Falha na varredura"
      );

    const redes=
      obj.redes||
      [];

    if(!redes.length){
      $("wifiScanStatus").textContent=
        "Nenhuma rede encontrada.";
      return;
    }

    $("wifiScanStatus").textContent=
      redes.length+
      (
        redes.length===1
        ? " rede encontrada."
        : " redes encontradas."
      );

    redes.forEach(rede=>{
      const btn=
        document.createElement(
          "button"
        );

      btn.type="button";

      btn.className=
        "wifi-network";

      const main=
        document.createElement(
          "div"
        );

      main.className=
        "wifi-network-main";

      const nome=
        document.createElement(
          "div"
        );

      nome.className=
        "wifi-network-name";

      nome.textContent=
        rede.ssid;

      const meta=
        document.createElement(
          "div"
        );

      meta.className=
        "wifi-network-meta";

      let detalhes=
        rede.aberta
        ? "Rede aberta"
        : "Protegida por senha";

      if(rede.conhecida)
        detalhes+=" • conhecida";

      if(rede.conectada)
        detalhes+=" • conectada";

      meta.textContent=
        detalhes;

      main.append(
        nome,
        meta
      );

      const sinal=
        document.createElement(
          "div"
        );

      sinal.className=
        "wifi-strength";

      sinal.textContent=
        rede.rssi+
        " dBm";

      btn.append(
        main,
        sinal
      );

      btn.onclick=()=>{
        $("wifiSSIDInput").value=
          rede.ssid;

        $("wifiPasswordInput").value="";

        $("wifiPasswordInput").focus();
      };

      $("wifiNetworks")
        .appendChild(btn);
    });

  }catch(e){
    $("wifiScanStatus").textContent=
      "Falha: "+
      e.message;
  }
}

async function salvarWiFi(){
  const ssid=
    $("wifiSSIDInput")
      .value
      .trim();

  const senha=
    $("wifiPasswordInput")
      .value;

  if(!ssid){
    $("wifiSaveStatus").textContent=
      "Selecione ou informe uma rede.";

    $("wifiSaveStatus").className=
      "wifi-save-status bad";

    return;
  }

  $("wifiSaveStatus").textContent=
    "Enviando configuração...";

  $("wifiSaveStatus").className=
    "wifi-save-status warn";

  try{
    const r=
      await fetch(
        "/wifiConfig",
        {
          method:"POST",
          headers:{
            "Content-Type":
              "application/json"
          },
          body:JSON.stringify({
            ssid,
            senha
          })
        }
      );

    const obj=
      await r.json();

    if(!r.ok)
      throw new Error(
        obj.erro||
        "Falha ao enviar configuração"
      );

    $("wifiSaveStatus").textContent=
      "Configuração recebida. A estação testará a nova rede. "+
      "A rede anterior só será substituída se o teste funcionar. "+
      "Se a página perder conexão, procure a estação na nova rede "+
      "ou conecte-se a EstacaoAmbiental-Setup.";

    $("wifiSaveStatus").className=
      "wifi-save-status warn";

    iniciarPollingWiFi();

  }catch(e){
    $("wifiSaveStatus").textContent=
      "Falha: "+
      e.message;

    $("wifiSaveStatus").className=
      "wifi-save-status bad";
  }
}

function iniciarPollingWiFi(){
  if(wifiPollTimer)
    clearInterval(
      wifiPollTimer
    );

  wifiPollTimer=
    setInterval(
      carregarStatusWiFi,
      1500
    );

  setTimeout(
    ()=>{
      if(wifiPollTimer){
        clearInterval(
          wifiPollTimer
        );

        wifiPollTimer=null;
      }
    },
    30000
  );
}

async function esquecerWiFi(){
  if(
    !confirm(
      "Deseja remover TODAS as redes Wi-Fi conhecidas? "+
      "A estação entrará no modo EstacaoAmbiental-Setup."
    )
  ) return;

  try{
    const r=
      await fetch(
        "/wifiForget",
        {
          method:"POST"
        }
      );

    if(!r.ok)
      throw new Error(
        "Não foi possível remover a rede."
      );

    $("wifiSaveStatus").textContent=
      "Todas as redes foram removidas. "+
      "Conecte-se a EstacaoAmbiental-Setup "+
      "para configurar uma nova rede.";

    $("wifiSaveStatus").className=
      "wifi-save-status warn";

    iniciarPollingWiFi();

  }catch(e){
    $("wifiSaveStatus").textContent=
      "Falha: "+
      e.message;

    $("wifiSaveStatus").className=
      "wifi-save-status bad";
  }
}

$("btnBannerWiFi").onclick=
  abrirWiFi;

$("wifiClose").onclick=
  fecharWiFi;

$("wifiOverlay").onclick=
  e=>{
    if(
      e.target===
      $("wifiOverlay")
    )
      fecharWiFi();
  };

$("btnScanWiFi").onclick=
  escanearWiFi;

$("btnSaveWiFi").onclick=
  salvarWiFi;

$("btnForgetWiFi").onclick=
  esquecerWiFi;

$("btnShowPassword").onclick=()=>{
  const campo=
    $("wifiPasswordInput");

  const mostrar=
    campo.type==="password";

  campo.type=
    mostrar
    ? "text"
    : "password";

  $("btnShowPassword").textContent=
    mostrar
    ? "Ocultar"
    : "Mostrar";
};

// ==========================================================
// CARREGAMENTO
// ==========================================================

async function carregar(){
  try{
    const [
      rd,
      re,
      rh,
      rv
    ]=
      await Promise.all([
        fetch("/dados",{cache:"no-store"}),
        fetch("/externo",{cache:"no-store"}),
        fetch("/historico",{cache:"no-store"}),
        fetch("/eventos",{cache:"no-store"})
      ]);

    if(
      !rd.ok||
      !re.ok||
      !rh.ok||
      !rv.ok
    )
      throw new Error(
        "Uma das rotas HTTP retornou erro."
      );

    dados=await rd.json();
    externo=await re.json();
    historico=await rh.json();
    eventos=await rv.json();

    sincronizarRelogio();
    desenharCards();
    desenharExterno();
    desenharGraficos();
    desenharEventos();

    carregarStatusWiFi();

  }catch(e){
    console.error(
      "Dashboard:",
      e
    );
  }
}

// ==========================================================
// BOTÕES
// ==========================================================

$("btnC").onclick=()=>{
  unidadeTemp="C";

  $("btnC").classList.add(
    "active"
  );

  $("btnF").classList.remove(
    "active"
  );

  desenharCards();
  desenharExterno();
  desenharGraficos();
};

$("btnF").onclick=()=>{
  unidadeTemp="F";

  $("btnF").classList.add(
    "active"
  );

  $("btnC").classList.remove(
    "active"
  );

  desenharCards();
  desenharExterno();
  desenharGraficos();
};

$("btnHPA").onclick=()=>{
  unidadePressao="hPa";

  $("btnHPA").classList.add(
    "active"
  );

  $("btnATM").classList.remove(
    "active"
  );

  desenharCards();
  desenharExterno();
  desenharGraficos();
};

$("btnATM").onclick=()=>{
  unidadePressao="atm";

  $("btnATM").classList.add(
    "active"
  );

  $("btnHPA").classList.remove(
    "active"
  );

  desenharCards();
  desenharExterno();
  desenharGraficos();
};

$("btnZerar").onclick=
  async()=>{
    await fetch("/zerar");
    carregar();
  };

$("btnLimpar").onclick=
  async()=>{
    if(
      !confirm(
        "Deseja limpar o histórico?"
      )
    ) return;

    await fetch("/limpar");
    carregar();
  };

$("btnLimparEventos").onclick=
  async()=>{
    if(
      !confirm(
        "Deseja limpar os eventos?"
      )
    ) return;

    await fetch(
      "/limparEventos"
    );

    carregar();
  };

// ==========================================================
// START
// ==========================================================

ativarTooltip(
  "grafTemp"
);

ativarTooltip(
  "grafPressao"
);

ativarTooltip(
  "grafUmidade"
);

window.addEventListener(
  "resize",
  desenharGraficos
);

inicializarTema();

carregar();
carregarStatusWiFi();

setInterval(
  carregar,
  10000
);
