const params = new URLSearchParams(window.location.search);
const provaMestreId = params.get("prova");
let token = params.get("token"); // matrícula do aluno
const content = document.getElementById("content");

const state = { prova: null, atual: 0, respostas: {}, segundosRestantes: null, timer: null };

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
  await carregarProva();
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
    history.replaceState(null, "", `?prova=${provaMestreId}&token=${encodeURIComponent(matricula)}`); // atualiza a URL, sem recarregar
    try {
      await carregarProva();
    } catch (e) {
      erroEl.innerHTML = `<div class="error-box">Matrícula não encontrada para este TDE. Confira com seu professor(a).</div>`;
      token = null;
    }
  }
}

async function carregarProva() {
  try {
    const prova = await api(`/prova/${provaMestreId}/${encodeURIComponent(token)}`);
    state.prova = prova;
    state.respostas = {};
    prova.questoes.forEach((q) => { if (q.respostaAlunoLetra) state.respostas[q.id] = q.respostaAlunoLetra; });
    state.segundosRestantes = prova.duracaoMinutos * 60;
    renderInstrucoes();
  } catch (e) {
    content.innerHTML = `<div class="error-box">Erro ao carregar a prova: ${e.message}</div>`;
    throw e;
  }
}

function renderInstrucoes() {
  const p = state.prova;
  content.innerHTML = `
    <div style="text-align:center; display:flex; flex-direction:column; gap:18px; align-items:center; padding-top:10px;">
      <div class="seal">✓ TDE - LA SALLE · EQUIVALÊNCIA VERIFICADA</div>
      <h1>${p.tituloProva}</h1>
      <p class="muted" style="font-size:14px; line-height:1.7;">
        Você é <b style="color:var(--ink);">${p.alunoNome}</b>. Esta prova contém <b style="color:var(--ink);">${p.questoes.length} questões</b>,
        equivalentes às de todos os colegas da turma — mesmos temas e mesma dificuldade, com valores individuais para cada aluno.
      </p>
      <div class="card" style="width:100%; text-align:left;">
        <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
        <div class="row" style="font-size:13px; padding:6px 0;"><span class="muted">Duração</span><span>${p.duracaoMinutos} minutos</span></div>
        <div class="row" style="font-size:13px; padding:6px 0; border-top:1px solid var(--line-faint);"><span class="muted">Questões</span><span>${p.questoes.length} de múltipla escolha</span></div>
        <div class="row" style="font-size:13px; padding:6px 0; border-top:1px solid var(--line-faint);"><span class="muted">Matrícula</span><span class="mono" style="color:var(--teal);">${token}</span></div>
      </div>
      <button class="btn" id="btn-iniciar">Iniciar prova →</button>
    </div>
  `;
  document.getElementById("btn-iniciar").addEventListener("click", () => {
    renderProva();
    state.timer = setInterval(tickTimer, 1000);
  });
}

function tickTimer() {
  state.segundosRestantes = Math.max(0, state.segundosRestantes - 1);
  const el = document.getElementById("timer");
  if (el) {
    const mm = String(Math.floor(state.segundosRestantes / 60)).padStart(2, "0");
    const ss = String(state.segundosRestantes % 60).padStart(2, "0");
    el.textContent = `${mm}:${ss}`;
    el.style.color = state.segundosRestantes < 300 ? "var(--red)" : "var(--teal)";
  }
  if (state.segundosRestantes === 0) finalizar();
}

function renderProva() {
  const p = state.prova;
  const q = p.questoes[state.atual];
  const mm = String(Math.floor(state.segundosRestantes / 60)).padStart(2, "0");
  const ss = String(state.segundosRestantes % 60).padStart(2, "0");

  content.innerHTML = `
    <div class="row" style="margin-bottom:10px;">
      <span class="mono muted" style="font-size:12px;">QUESTÃO ${state.atual + 1} / ${p.questoes.length}</span>
      <span class="mono" id="timer" style="font-size:13px; color:${state.segundosRestantes<300?'var(--red)':'var(--teal)'};">⏱ ${mm}:${ss}</span>
    </div>

    <div class="progress-track">
      ${p.questoes.map((qq, i) => `<div class="progress-seg ${state.respostas[qq.id] ? 'answered' : (i===state.atual?'current':'')}" data-jump="${i}"></div>`).join("")}
    </div>

    <div class="card">
      <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
      <span class="pill">${q.tema}</span>
      ${q.imagem ? `<img src="${q.imagem}" style="max-width:min(100%, 420px); max-height:320px; width:auto; height:auto; display:block; margin:14px auto 0; border:1px solid var(--line-faint); cursor:zoom-in;" onclick="window.open('${q.imagem}', '_blank')" title="Clique para ampliar" />` : ""}
      <div style="font-size:15.5px; line-height:1.7; margin-top:14px;">${q.enunciado}</div>
      <div style="margin-top:18px;">
        ${q.alternativas.map((a) => `
          <div class="option ${state.respostas[q.id]===a.letra?'selected':''}" data-letra="${a.letra}">
            <div class="option-letter">${a.letra}</div>
            <span class="mono" style="font-size:14px;">${a.campos.map(c => `${c.nome} = ${c.valor} ${c.unidade}`).join("   |   ")}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="row" style="margin-top:16px;">
      <button class="btn ghost" id="btn-anterior" ${state.atual===0?'disabled':''}>← Anterior</button>
      ${state.atual < p.questoes.length - 1
        ? `<button class="btn" id="btn-proxima">Próxima →</button>`
        : `<button class="btn" id="btn-finalizar">✓ Finalizar prova</button>`}
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
}

async function finalizar() {
  if (state.timer) clearInterval(state.timer);
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
      <h1 style="font-size:22px;">Prova corrigida automaticamente</h1>
      <p class="muted" style="font-size:14px;">Você acertou <b style="color:var(--ink);">${r.acertos} de ${r.total}</b> questões.</p>
      <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
        ${r.detalhe.map((d) => `
          <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:var(--surface); border:1px solid var(--line-faint);">
            <span style="color:${d.correta?'var(--green)':'var(--red)'};">${d.correta ? "✓" : "✗"}</span>
            <span class="muted" style="font-size:12.5px; text-align:left; flex:1;">${d.tema}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

iniciar();
