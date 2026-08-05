const state = {
  view: "dashboard",
  provas: [],
  questoes: [],
  selecionadas: new Set(),
  provaAtualId: null,
  publicarResultado: null,
};

const content = document.getElementById("content");
const navEl = document.getElementById("nav");

navEl.querySelectorAll(".nav-item").forEach((el) => {
  el.addEventListener("click", () => setView(el.dataset.view));
});

function setView(view) {
  state.view = view;
  navEl.querySelectorAll(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.view === view));
  render();
}

async function api(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.erro || `Erro ${res.status}`);
  }
  return res.json();
}

async function render() {
  content.innerHTML = `<div class="spinner">Carregando…</div>`;
  try {
    if (state.view === "dashboard") await renderDashboard();
    else if (state.view === "banco") await renderBanco();
    else if (state.view === "montar") await renderMontar();
    else if (state.view === "resultados") await renderResultados();
  } catch (e) {
    content.innerHTML = `<div class="error-box">Erro: ${e.message}. Confira se o backend está rodando e o banco foi migrado/seedado.</div>`;
  }
}

/* ---------------- Dashboard ---------------- */
async function renderDashboard() {
  const provas = await api("/provas-mestre");
  state.provas = provas;

  const totalQuestoes = provas.reduce((a, p) => a + p.totalQuestoes, 0);
  content.innerHTML = `
    <div class="eyebrow">PAINEL DO PROFESSOR</div>
    <h1 style="margin-bottom:20px;">Provas-Mestre cadastradas</h1>

    <div class="grid-stats" style="margin-bottom:20px;">
      <div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
        <div class="stat-label">Provas-mestre</div><div class="stat-value">${provas.length}</div></div>
      <div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
        <div class="stat-label">Publicadas</div><div class="stat-value">${provas.filter(p=>p.status==='publicada').length}</div></div>
      <div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
        <div class="stat-label">Questões no banco</div><div class="stat-value">6</div></div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
      <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:14px;">Lista</div>
      ${provas.length === 0 ? `<div class="muted" style="font-size:13px;">Nenhuma Prova-Mestre criada ainda.</div>` : ""}
      ${provas.map((p, i) => `
        <div class="row" style="padding:12px 0; ${i>0?'border-top:1px solid var(--line-faint);':''}">
          <div>
            <div style="font-weight:600; font-size:14px;">${p.titulo}</div>
            <div class="muted" style="font-size:12px; margin-top:2px;">${p.turma} · ${p.totalQuestoes} questões · ${p.totalAlunos} provas geradas</div>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <span class="pill ${p.status==='publicada'?'teal':''}">${p.status}</span>
            ${p.status==='publicada' ? `<button class="btn subtle" data-ver-resultado="${p.id}">Ver resultados</button>` : ""}
          </div>
        </div>
      `).join("")}
    </div>

    <button class="btn" id="btn-nova-prova">+ Nova Prova-Mestre</button>
  `;

  document.getElementById("btn-nova-prova").addEventListener("click", () => setView("montar"));
  content.querySelectorAll("[data-ver-resultado]").forEach((el) => {
    el.addEventListener("click", () => {
      state.provaAtualId = el.dataset.verResultado;
      setView("resultados");
    });
  });
}

/* ---------------- Banco de Questões ---------------- */
async function renderBanco() {
  const questoes = await api("/questoes");
  state.questoes = questoes;

  content.innerHTML = `
    <div class="eyebrow">BANCO DE QUESTÕES</div>
    <h1 style="margin-bottom:20px;">${questoes.length} questões cadastradas</h1>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
      <div>
        ${questoes.map((q) => `
          <div class="card" style="margin-bottom:10px; cursor:pointer;" data-questao="${q.id}">
            <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
            <div class="row">
              <div style="font-weight:600; font-size:13.5px;">${q.tema}</div>
              <div class="dots">${[1,2,3,4,5].map(i => `<div class="dot ${i<=q.dificuldade?'on':''}"></div>`).join("")}</div>
            </div>
            <div class="mono muted" style="font-size:11.5px; margin-top:8px; line-height:1.6;">${q.preview.enunciado}</div>
          </div>
        `).join("")}
      </div>
      <div id="preview-pane">
        <div class="card muted" style="text-align:center; padding:40px; font-size:13px;">
          <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
          Clique em uma questão para ver a parametrização
        </div>
      </div>
    </div>
  `;

  content.querySelectorAll("[data-questao]").forEach((el) => {
    el.addEventListener("click", () => {
      const q = questoes.find((x) => x.id === el.dataset.questao);
      document.getElementById("preview-pane").innerHTML = `
        <div class="card accent-amber">
          <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
          <span class="pill amber">Preview parametrizado</span>
          <div style="font-weight:600; font-size:15px; margin-top:12px;">${q.tema}</div>
          <div style="font-size:13.5px; margin-top:10px; line-height:1.6;">${q.preview.enunciado}</div>
          <div class="divider mono muted" style="font-size:12px;">
            <div>Resposta correta: <span style="color:var(--green);">${q.preview.respostaCorreta} ${q.unidade}</span></div>
            <div style="margin-top:4px;">Cada aluno recebe outros valores dentro das mesmas faixas — mesmo raciocínio, mesma dificuldade.</div>
          </div>
        </div>
      `;
    });
  });
}

/* ---------------- Criar Prova-Mestre ---------------- */
async function renderMontar() {
  if (state.publicarResultado) {
    const r = state.publicarResultado;
    content.innerHTML = `
      <div class="seal" style="margin-bottom:16px;">✓ PROVA-MESTRE · EQUIVALÊNCIA VERIFICADA</div>
      <h1 style="margin-bottom:20px;">Prova-Mestre publicada</h1>
      <div class="card accent-teal" style="margin-bottom:20px;">
        <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
        <div class="grid-stats">
          <div><div class="stat-label">Provas geradas</div><div class="stat-value">${r.totalGeradas}<small>alunos</small></div></div>
        </div>
        <div class="divider" style="font-size:13px; color:var(--ink-muted); line-height:1.6;">
          Cada aluno recebeu uma prova individual: mesmas questões, ordem embaralhada, valores numéricos e alternativas
          recalculados. Um <span class="mono" style="color:var(--teal);">seed</span> único por aluno garante que a geração seja auditável.
        </div>
      </div>
      <div class="card">
        <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
        <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:12px;">Links individuais (abra em modo aluno)</div>
        ${r.provas.map((p) => `
          <div class="row" style="padding:8px 0; border-top:1px solid var(--line-faint);">
            <span style="font-size:13px;">${p.alunoNome}</span>
            <a href="/aluno.html?token=${p.qrToken}" target="_blank" class="btn subtle" style="padding:5px 10px; font-size:12px;">Abrir prova →</a>
          </div>
        `).join("")}
      </div>
      <button class="btn ghost" style="margin-top:20px;" id="btn-voltar-dash">Voltar ao dashboard</button>
    `;
    document.getElementById("btn-voltar-dash").addEventListener("click", () => {
      state.publicarResultado = null;
      setView("dashboard");
    });
    return;
  }

  const questoes = await api("/questoes");
  state.questoes = questoes;
  if (state.selecionadas.size === 0) {
    questoes.slice(0, 4).forEach((q) => state.selecionadas.add(q.id));
  }

  content.innerHTML = `
    <div class="eyebrow">NOVA PROVA-MESTRE</div>
    <h1 style="margin-bottom:20px;">Selecione as questões</h1>
    <div style="display:grid; grid-template-columns:1.3fr 1fr; gap:16px; align-items:start;">
      <div id="lista-questoes">
        ${questoes.map((q) => `
          <div class="list-item ${state.selecionadas.has(q.id) ? "checked" : ""}" data-toggle="${q.id}">
            <div class="checkbox ${state.selecionadas.has(q.id) ? "on" : ""}">${state.selecionadas.has(q.id) ? "✓" : ""}</div>
            <div style="flex:1;"><div style="font-weight:600; font-size:13.5px;">${q.tema}</div></div>
            <div class="dots">${[1,2,3,4,5].map(i => `<div class="dot ${i<=q.dificuldade?'on':''}"></div>`).join("")}</div>
          </div>
        `).join("")}
      </div>
      <div class="card">
        <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
        <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:14px;">Configuração</div>
        <div class="field">
          <label>Título da prova</label>
          <input id="titulo" value="Avaliação Bimestral — Física/Matemática" />
        </div>
        <div class="field">
          <label>Turma</label>
          <select id="turma">
            <option>3º Ano A — Física/Matemática</option>
            <option>3º Ano B — Física/Matemática</option>
            <option>2º Ano A — Ciências</option>
          </select>
        </div>
        <div class="field">
          <label>Duração (minutos)</label>
          <input id="duracao" class="mono" type="number" value="50" />
        </div>
        <div class="row divider" style="font-size:12.5px; color:var(--ink-muted);">
          <span>Questões selecionadas</span>
          <span class="mono" style="color:var(--teal);" id="contador">${state.selecionadas.size}</span>
        </div>
        <button class="btn" id="btn-publicar" style="width:100%; justify-content:center;" ${state.selecionadas.size === 0 ? "disabled" : ""}>
          Publicar e gerar 8 provas individuais
        </button>
      </div>
    </div>
  `;

  content.querySelectorAll("[data-toggle]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.toggle;
      if (state.selecionadas.has(id)) state.selecionadas.delete(id);
      else state.selecionadas.add(id);
      renderMontar();
    });
  });

  document.getElementById("btn-publicar").addEventListener("click", async (e) => {
    e.target.disabled = true;
    e.target.textContent = "Gerando provas…";
    try {
      const titulo = document.getElementById("titulo").value;
      const turma = document.getElementById("turma").value;
      const duracaoMinutos = Number(document.getElementById("duracao").value);
      const questaoIds = Array.from(state.selecionadas);

      const provaMestre = await api("/provas-mestre", {
        method: "POST",
        body: JSON.stringify({ titulo, turma, duracaoMinutos, questaoIds }),
      });
      const resultado = await api(`/provas-mestre/${provaMestre.id}/publicar`, { method: "POST" });
      state.provaAtualId = provaMestre.id;
      state.publicarResultado = resultado;
      renderMontar();
    } catch (err) {
      alert("Erro ao publicar: " + err.message);
      e.target.disabled = false;
      e.target.textContent = "Publicar e gerar 8 provas individuais";
    }
  });
}

/* ---------------- Resultados ---------------- */
async function renderResultados() {
  const provas = await api("/provas-mestre");
  const publicadas = provas.filter((p) => p.status === "publicada");

  if (publicadas.length === 0) {
    content.innerHTML = `<div class="card muted" style="text-align:center; padding:40px; font-size:13px;">
      <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
      Nenhuma Prova-Mestre publicada ainda. Crie e publique uma em "Criar Prova-Mestre".</div>`;
    return;
  }

  if (!state.provaAtualId || !publicadas.find((p) => p.id === state.provaAtualId)) {
    state.provaAtualId = publicadas[0].id;
  }

  const r = await api(`/provas-mestre/${state.provaAtualId}/resultados`);
  const provaSel = publicadas.find((p) => p.id === state.provaAtualId);

  content.innerHTML = `
    <div class="eyebrow">RESULTADOS</div>
    <div class="row" style="margin-bottom:20px; align-items:flex-end;">
      <h1>${provaSel.titulo}</h1>
      <select id="select-prova" class="mono" style="background:var(--surface-raised); border:1px solid var(--line); color:var(--ink); padding:6px 10px; font-size:12px;">
        ${publicadas.map((p) => `<option value="${p.id}" ${p.id === state.provaAtualId ? "selected" : ""}>${p.titulo}</option>`).join("")}
      </select>
    </div>

    <div class="grid-stats" style="margin-bottom:14px;">
      <div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
        <div class="stat-label">Média</div><div class="stat-value">${r.media ?? "—"}</div></div>
      <div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
        <div class="stat-label">Mediana</div><div class="stat-value">${r.mediana ?? "—"}</div></div>
      <div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
        <div class="stat-label">Desvio padrão</div><div class="stat-value">${r.desvioPadrao ?? "—"}</div></div>
    </div>

    <div class="card" style="margin-bottom:14px;">
      <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
      <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:10px;">⚠ Questões com mais erro</div>
      ${r.rankingErros.length === 0 ? `<div class="muted" style="font-size:12.5px;">Ainda sem respostas suficientes.</div>` : r.rankingErros.slice(0,4).map((q) => `
        <div style="margin-bottom:10px;">
          <div class="row" style="font-size:12.5px; margin-bottom:4px;"><span class="muted">${q.tema}</span><span class="mono" style="color:var(--amber);">${q.percentualErro}%</span></div>
          <div style="height:4px; background:var(--line-faint);"><div style="height:4px; width:${q.percentualErro}%; background:var(--amber);"></div></div>
        </div>
      `).join("")}
    </div>

    <div class="card">
      <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
      <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:6px;">Notas por aluno (${r.totalFinalizadas}/${r.totalAlunos} finalizaram)</div>
      ${r.alunos.map((a, i) => `
        <div class="row" style="padding:10px 0; ${i>0?'border-top:1px solid var(--line-faint);':''}">
          <span style="font-size:13.5px;">${a.alunoNome}</span>
          <span class="mono muted" style="font-size:12px;">${a.status === 'finalizada' ? `${a.acertos}/${a.total} acertos` : a.status}</span>
          <span style="font-family:var(--f-display); font-weight:700; font-size:15px; width:40px; text-align:right; color:${a.nota===null?'var(--ink-faint)':(a.nota>=6?'var(--green)':'var(--red)')};">
            ${a.nota !== null ? a.nota.toFixed(1) : "—"}
          </span>
        </div>
      `).join("")}
    </div>
  `;

  document.getElementById("select-prova").addEventListener("change", (e) => {
    state.provaAtualId = e.target.value;
    renderResultados();
  });
}

render();
