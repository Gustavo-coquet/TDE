const params = new URLSearchParams(window.location.search);
const provaMestreId = params.get("prova");
let token = params.get("token"); // matrícula do aluno
const content = document.getElementById("content");

const state = { prova: null, atual: 0, respostas: {} };

function formatarBR(n) {
  return Number(n).toLocaleString("pt-BR");
}

async function api(path, options) {
  const res = await fetch(`/api${path}`, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.erro || `Erro ${res.status}`);
  }
  return res.json();
}

async function iniciar() {
  if (!provaMestreId) {
    content.innerHTML = `<div class="error-box">Link inválido: falta identificar o TDE. Peça o link correto ao professor(a).</div>`;
    return;
  }
  if (!token) return renderCodigo();
  await carregarEstado();
}

function renderCodigo() {
  content.innerHTML = `
    <div style="text-align:center; padding-top:20px;">
      <h1>Digite sua matrícula</h1>
      <p class="muted" style="font-size:13px; margin-bottom:20px;">Use a mesma matrícula cadastrada pelo seu professor(a).</p>
      <input id="codigo-input" class="mono" style="text-align:center; font-size:22px; letter-spacing:.1em; padding:14px; background:var(--surface-raised); border:1px solid var(--line); color:var(--teal); width:100%; margin-bottom:14px;" placeholder="Sua matrícula" autofocus />
      <div id="erro-codigo"></div>
      <button class="btn" id="btn-entrar-codigo" style="width:100%; justify-content:center;">Acessar prova</button>
    </div>
  `;
  const input = document.getElementById("codigo-input");
  input.focus();
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") entrar(); });
  document.getElementById("btn-entrar-codigo").addEventListener("click", entrar);

  async function entrar() {
    const matricula = input.value.trim();
    const erroEl = document.getElementById("erro-codigo");
    erroEl.innerHTML = "";
    if (!matricula) return;
    token = matricula;
    history.replaceState(null, "", `?prova=${provaMestreId}&token=${encodeURIComponent(matricula)}`);
    try {
      await carregarEstado();
    } catch (e) {
      erroEl.innerHTML = `<div class="error-box">${e.message}</div>`;
      token = null;
    }
  }
}

// Busca o estado atual do aluno nesse TDE e decide o que mostrar:
// em andamento (nova tentativa ou retomando) | aguardando decisão (tentativa já finalizada) 
async function carregarEstado() {
  try {
    const dados = await api(`/prova/${provaMestreId}/${encodeURIComponent(token)}`);
    if (dados.estado === "em_andamento") {
      state.prova = dados;
      state.respostas = {};
      dados.questoes.forEach((q) => { if (q.respostaAlunoLetra) state.respostas[q.id] = q.respostaAlunoLetra; });
      state.atual = 0;
      renderInstrucoes();
    } else {
      renderDecisao(dados);
    }
  } catch (e) {
    content.innerHTML = `<div class="error-box">Erro ao carregar a prova: ${e.message}</div>`;
    throw e;
  }
}

function renderDecisao(dados) {
  content.innerHTML = `
    <div style="text-align:center; display:flex; flex-direction:column; gap:16px; align-items:center; padding-top:20px;">
      <div style="width:92px; height:92px; border-radius:50%; border:2px solid var(--teal); display:flex; align-items:center; justify-content:center;">
        <span style="font-family:var(--f-display); font-size:22px; font-weight:700; color:var(--teal);">${formatarBR(+dados.melhorNota.toFixed(1))}</span>
      </div>
      <h1 style="font-size:20px;">${dados.tituloProva}</h1>
      <p class="muted" style="font-size:13.5px;">
        Olá, <b style="color:var(--ink);">${dados.alunoNome}</b>! Sua melhor nota até agora é <b style="color:var(--ink);">${formatarBR(+dados.melhorNota.toFixed(1))} de ${formatarBR(dados.valor)}</b>,
        em ${dados.tentativasFeitas} tentativa${dados.tentativasFeitas > 1 ? "s" : ""}.
      </p>
      ${dados.podeTentarDeNovo ? `
        <p class="muted" style="font-size:13px;">Você ainda pode fazer uma segunda tentativa, se quiser. Vale a <b style="color:var(--ink);">maior</b> das duas notas.</p>
        <button class="btn" id="btn-nova-tentativa">Fazer segunda tentativa</button>
      ` : `
        <div class="pill teal">Não há mais tentativas disponíveis para este TDE</div>
      `}
    </div>
  `;

  const btn = document.getElementById("btn-nova-tentativa");
  if (btn) {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Gerando…";
      try {
        const dadosNovos = await api(`/prova/${provaMestreId}/${encodeURIComponent(token)}/nova-tentativa`, { method: "POST" });
        state.prova = dadosNovos;
        state.respostas = {};
        state.atual = 0;
        renderInstrucoes();
      } catch (e) {
        content.innerHTML = `<div class="error-box">Erro ao iniciar nova tentativa: ${e.message}</div>`;
      }
    });
  }
}

const FRASES_BOA_SORTE = [
  "Respire fundo, leia com calma e confie no que você estudou.",
  "Você se preparou pra isso — agora é só mostrar o que sabe!",
  "Sem pressa: leia cada questão com atenção antes de responder.",
  "Vai com calma, questão por questão. Você consegue!",
];

function renderInstrucoes() {
  const p = state.prova;
  const frase = FRASES_BOA_SORTE[Math.floor(Math.random() * FRASES_BOA_SORTE.length)];
  content.innerHTML = `
    <div style="text-align:center; display:flex; flex-direction:column; gap:18px; align-items:center; padding-top:10px;">
      <div class="seal">✓ TDE - LA SALLE · EQUIVALÊNCIA VERIFICADA</div>
      <h1>Olá, ${p.alunoNome}! 👋</h1>
      <p class="muted" style="font-size:14px; line-height:1.7;">${frase} Boa sorte! 🍀</p>
      <div class="card" style="width:100%; text-align:left;">
        <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
        <div style="font-weight:600; font-size:15px; margin-bottom:4px;">${p.tituloProva}</div>
        <div class="muted" style="font-size:12.5px; margin-bottom:10px;">Tentativa ${p.tentativa} de no máximo 2</div>
        <div class="row" style="font-size:13px; padding:6px 0; border-top:1px solid var(--line-faint);"><span class="muted">Este TDE tem</span><span>${p.questoes.length} questões</span></div>
        <div class="row" style="font-size:13px; padding:6px 0; border-top:1px solid var(--line-faint);"><span class="muted">e vale</span><span style="color:var(--teal); font-weight:600;">${formatarBR(p.valor)} pontos</span></div>
        <div class="row" style="font-size:13px; padding:6px 0; border-top:1px solid var(--line-faint);"><span class="muted">Matrícula</span><span class="mono" style="color:var(--teal);">${token}</span></div>
        ${p.prazoFinal ? `<div class="row" style="font-size:13px; padding:6px 0; border-top:1px solid var(--line-faint);"><span class="muted">Prazo final</span><span>${new Date(p.prazoFinal).toLocaleString("pt-BR")}</span></div>` : ""}
      </div>
      <p class="muted" style="font-size:12px; line-height:1.6;">
        Todos os colegas da turma respondem o mesmo TDE, com a mesma dificuldade — só os valores numéricos mudam de aluno pra aluno.<br>
        Sem tempo limite por sessão: responda com calma, e pode fechar e voltar depois, dentro do prazo.
      </p>
      <button class="btn" id="btn-iniciar">Iniciar TDE →</button>
    </div>
  `;
  document.getElementById("btn-iniciar").addEventListener("click", () => renderProva());
}

function renderProva() {
  const p = state.prova;
  const q = p.questoes[state.atual];

  content.innerHTML = `
    <div class="row" style="margin-bottom:10px;">
      <span class="mono muted" style="font-size:12px;">QUESTÃO ${state.atual + 1} / ${p.questoes.length}</span>
      <span class="mono muted" style="font-size:11px;">Tentativa ${p.tentativa}</span>
    </div>

    <div class="progress-track">
      ${p.questoes.map((qq, i) => `<div class="progress-seg ${state.respostas[qq.id] ? 'answered' : (i===state.atual?'current':'')}" data-jump="${i}"></div>`).join("")}
    </div>
    <div class="muted" style="font-size:11px; margin-bottom:14px;">💾 Suas respostas são salvas automaticamente. Pode pular questões e sair a qualquer momento — depois é só voltar com o mesmo link.</div>

    <div class="card">
      <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
      <span class="pill">${q.tema}</span>
      ${q.imagem ? `<img src="${q.imagem}" style="max-width:min(100%, 420px); max-height:320px; width:auto; height:auto; display:block; margin:14px auto 0; border:1px solid var(--line-faint); cursor:zoom-in;" onclick="window.open('${q.imagem}', '_blank')" title="Clique para ampliar" />` : ""}
      <div style="font-size:15.5px; line-height:1.7; margin-top:14px;">${q.enunciado}</div>
      <div style="margin-top:18px;">
        ${q.alternativas.map((a) => `
          <div class="option ${state.respostas[q.id]===a.letra?'selected':''}" data-letra="${a.letra}">
            <div class="option-letter">${a.letra}</div>
            <span class="mono" style="font-size:14px;">${a.campos.map(c => `${c.nome} = ${formatarBR(c.valor)} ${c.unidade}`).join("   |   ")}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="row" style="margin-top:16px;">
      <button class="btn ghost" id="btn-anterior" ${state.atual===0?'disabled':''}>← Anterior</button>
      <div style="display:flex; gap:8px;">
        <button class="btn ghost" id="btn-pausar" style="font-size:12.5px;">Salvar e sair</button>
        ${state.atual < p.questoes.length - 1
          ? `<button class="btn" id="btn-proxima">Próxima →</button>`
          : `<button class="btn" id="btn-finalizar">✓ Finalizar prova</button>`}
      </div>
    </div>
  `;

  content.querySelectorAll("[data-letra]").forEach((el) => {
    el.addEventListener("click", async () => {
      const letra = el.dataset.letra;
      state.respostas[q.id] = letra;
      renderProva();
      try {
        await api(`/prova/${provaMestreId}/${encodeURIComponent(token)}/responder`, {
          method: "POST",
          body: JSON.stringify({ provaIndividualQuestaoId: q.id, letra }),
        });
      } catch (e) {
        console.error("Falha ao salvar resposta:", e.message);
      }
    });
  });

  content.querySelectorAll("[data-jump]").forEach((el) => {
    el.addEventListener("click", () => { state.atual = Number(el.dataset.jump); renderProva(); });
  });

  const btnAnt = document.getElementById("btn-anterior");
  if (btnAnt) btnAnt.addEventListener("click", () => { state.atual = Math.max(0, state.atual - 1); renderProva(); });
  const btnProx = document.getElementById("btn-proxima");
  if (btnProx) btnProx.addEventListener("click", () => { state.atual++; renderProva(); });
  const btnFim = document.getElementById("btn-finalizar");
  if (btnFim) btnFim.addEventListener("click", finalizar);
  const btnPausar = document.getElementById("btn-pausar");
  if (btnPausar) btnPausar.addEventListener("click", () => renderPausado());
}

function renderPausado() {
  const p = state.prova;
  const respondidas = Object.keys(state.respostas).length;
  content.innerHTML = `
    <div style="text-align:center; display:flex; flex-direction:column; gap:16px; align-items:center; padding-top:40px;">
      <div style="width:80px; height:80px; border-radius:50%; border:2px solid var(--teal); display:flex; align-items:center; justify-content:center; font-size:28px;">💾</div>
      <h1 style="font-size:20px;">Suas respostas estão salvas</h1>
      <p class="muted" style="font-size:13.5px; line-height:1.7; max-width:420px;">
        Você respondeu <b style="color:var(--ink);">${respondidas} de ${p.questoes.length}</b> questões até agora.
        Pode fechar esta página tranquilo(a) — quando quiser continuar, é só abrir o mesmo link de novo
        ${p.prazoFinal ? `, até <b style="color:var(--ink);">${new Date(p.prazoFinal).toLocaleString("pt-BR")}</b>` : ""}.
      </p>
      <button class="btn" id="btn-continuar-respondendo">Continuar respondendo agora</button>
    </div>
  `;
  document.getElementById("btn-continuar-respondendo").addEventListener("click", () => renderProva());
}

async function finalizar() {
  try {
    const resultado = await api(`/prova/${provaMestreId}/${encodeURIComponent(token)}/finalizar`, { method: "POST" });
    renderResultado(resultado);
  } catch (e) {
    content.innerHTML = `<div class="error-box">Erro ao finalizar: ${e.message}</div>`;
  }
}

function renderResultado(r) {
  const cor = r.percentual >= 60 ? "var(--green)" : "var(--red)";
  content.innerHTML = `
    <div style="text-align:center; display:flex; flex-direction:column; gap:16px; align-items:center; padding-top:30px;">
      <div style="width:96px; height:96px; border-radius:50%; border:2px solid ${cor}; display:flex; align-items:center; justify-content:center;">
        <span style="font-family:var(--f-display); font-size:26px; font-weight:700; color:${cor};">${r.percentual}%</span>
      </div>
      <h1 style="font-size:22px;">Tentativa ${r.tentativa} corrigida automaticamente</h1>
      <p class="muted" style="font-size:14px;">
        Você acertou <b style="color:var(--ink);">${r.acertos} de ${r.total}</b> questões —
        nota <b style="color:var(--ink);">${formatarBR(+r.notaPontos.toFixed(1))} de ${formatarBR(r.valor)}</b>.
      </p>
      <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
        ${r.detalhe.map((d) => `
          <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:var(--surface); border:1px solid var(--line-faint);">
            <span style="color:${d.correta?'var(--green)':'var(--red)'};">${d.correta ? "✓" : "✗"}</span>
            <span class="muted" style="font-size:12.5px; text-align:left; flex:1;">${d.tema}</span>
          </div>
        `).join("")}
      </div>
      ${r.podeTentarDeNovo ? `
        <div class="card" style="width:100%; text-align:center; margin-top:8px;">
          <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
          <p style="font-size:13.5px; margin-bottom:6px;">Quer tentar melhorar sua nota agora? Vale a <b>maior</b> das duas tentativas.</p>
          <p class="muted" style="font-size:12px; margin-bottom:12px;">
            Sem pressa — você pode fechar esta página e voltar outro dia (usando o mesmo link) pra fazer a segunda tentativa quando quiser, dentro do prazo${r.prazoFinal ? ` (até ${new Date(r.prazoFinal).toLocaleDateString("pt-BR")})` : ""}.
          </p>
          <button class="btn" id="btn-tentar-de-novo">Fazer segunda tentativa agora</button>
          <button class="btn ghost" id="btn-encerrar" style="margin-left:8px;">Voltar depois</button>
        </div>
      ` : ""}
    </div>
  `;

  const btnNova = document.getElementById("btn-tentar-de-novo");
  if (btnNova) {
    btnNova.addEventListener("click", async () => {
      btnNova.disabled = true;
      btnNova.textContent = "Gerando…";
      try {
        const dadosNovos = await api(`/prova/${provaMestreId}/${encodeURIComponent(token)}/nova-tentativa`, { method: "POST" });
        state.prova = dadosNovos;
        state.respostas = {};
        state.atual = 0;
        renderInstrucoes();
      } catch (e) {
        content.innerHTML = `<div class="error-box">Erro ao iniciar nova tentativa: ${e.message}</div>`;
      }
    });
  }
  const btnFim = document.getElementById("btn-encerrar");
  if (btnFim) btnFim.addEventListener("click", () => carregarEstado());
}

iniciar();
