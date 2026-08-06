const state = {
  view: "dashboard",
  turmaAtualId: null,
  provaAtualId: null,
  questoes: [],
  turmas: [],
  selecionadas: new Set(),
  alunosSelecionados: new Set(),
  publicarResultado: null,
  novaQuestaoVars: [{ nome: "", min: 0, max: 10, decimais: 0 }, { nome: "", min: 0, max: 10, decimais: 0 }],
};

const content = document.getElementById("content");
const navEl = document.getElementById("nav");

navEl.querySelectorAll(".nav-item").forEach((el) => {
  el.addEventListener("click", () => setView(el.dataset.view));
});

function setView(view, extra) {
  state.view = view;
  if (extra) Object.assign(state, extra);
  const destaque = view === "turmaDetalhe" || view === "montar" ? "turmas" : view;
  navEl.querySelectorAll(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.view === destaque));
  render();
}

function corners() {
  return `<div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>`;
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
    else if (state.view === "turmas") await renderTurmas();
    else if (state.view === "turmaDetalhe") await renderTurmaDetalhe();
    else if (state.view === "banco") await renderBanco();
    else if (state.view === "montar") await renderMontar();
    else if (state.view === "resultados") await renderResultados();
  } catch (e) {
    content.innerHTML = `<div class="error-box">Erro: ${e.message}. Confira se o backend está rodando e o banco foi migrado.</div>`;
  }
}

/* ---------------- Dashboard ---------------- */
async function renderDashboard() {
  const [turmas, questoes, provas] = await Promise.all([
    api("/turmas"), api("/questoes"), api("/provas-mestre"),
  ]);

  const totalAlunos = turmas.reduce((a, t) => a + t.totalAlunos, 0);

  content.innerHTML = `
    <div class="eyebrow">PAINEL DO PROFESSOR</div>
    <h1 style="margin-bottom:20px;">Visão geral</h1>

    <div class="grid-stats" style="margin-bottom:20px;">
      <div class="card">${corners()}<div class="stat-label">Turmas</div><div class="stat-value">${turmas.length}</div></div>
      <div class="card">${corners()}<div class="stat-label">Alunos matriculados</div><div class="stat-value">${totalAlunos}</div></div>
      <div class="card">${corners()}<div class="stat-label">TDEs criados</div><div class="stat-value">${provas.length}</div></div>
      <div class="card">${corners()}<div class="stat-label">Questões no banco</div><div class="stat-value">${questoes.length}</div></div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      ${corners()}
      <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:14px;">TDEs recentes</div>
      ${provas.length === 0 ? `<div class="muted" style="font-size:13px;">Nenhum TDE criado ainda.</div>` : ""}
      ${provas.slice(0, 8).map((p, i) => `
        <div class="row" style="padding:12px 0; ${i>0?'border-top:1px solid var(--line-faint);':''}">
          <div>
            <div style="font-weight:600; font-size:14px;">${p.titulo}</div>
            <div class="muted" style="font-size:12px; margin-top:2px;">${p.turmaNome} · ${p.totalQuestoes} questões · ${p.totalAlunos} provas geradas</div>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <span class="pill ${p.status==='publicada'?'teal':''}">${p.status}</span>
            ${p.status==='publicada' ? `<button class="btn subtle" data-ver-resultado="${p.id}">Ver resultados</button>` : ""}
          </div>
        </div>
      `).join("")}
    </div>

    <div style="display:flex; gap:10px;">
      <button class="btn" id="btn-ir-turmas">${turmas.length === 0 ? "+ Criar minha primeira turma" : "Ir para Turmas"}</button>
    </div>
  `;

  document.getElementById("btn-ir-turmas").addEventListener("click", () => setView("turmas"));
  content.querySelectorAll("[data-ver-resultado]").forEach((el) => {
    el.addEventListener("click", () => setView("resultados", { provaAtualId: el.dataset.verResultado }));
  });
}

/* ---------------- Turmas (lista) ---------------- */
async function renderTurmas() {
  const turmas = await api("/turmas");
  state.turmas = turmas;

  content.innerHTML = `
    <div class="eyebrow">TURMAS</div>
    <h1 style="margin-bottom:20px;">${turmas.length} turmas cadastradas</h1>

    <div class="card" style="margin-bottom:20px; max-width:420px;">
      ${corners()}
      <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:12px;">Nova turma</div>
      <div class="field"><label>Nome da turma</label><input id="nova-turma-nome" placeholder="Ex: 3º Ano A — Física" /></div>
      <div id="erro-turma"></div>
      <button class="btn" id="btn-criar-turma">+ Criar turma</button>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:14px;">
      ${turmas.map((t) => `
        <div class="card" style="cursor:pointer;" data-turma="${t.id}">
          ${corners()}
          <div style="font-weight:600; font-size:15px; margin-bottom:10px;">${t.nome}</div>
          <div class="row" style="font-size:12px; color:var(--ink-faint);">
            <span>${t.totalAlunos} alunos</span>
            <span>${t.totalTdes} TDEs</span>
          </div>
        </div>
      `).join("")}
      ${turmas.length === 0 ? `<div class="card muted" style="text-align:center; padding:30px; font-size:13px; grid-column:1/-1;">${corners()}Nenhuma turma cadastrada ainda. Crie a primeira acima.</div>` : ""}
    </div>
  `;

  document.getElementById("btn-criar-turma").addEventListener("click", async () => {
    const nome = document.getElementById("nova-turma-nome").value.trim();
    const erroEl = document.getElementById("erro-turma");
    if (!nome) { erroEl.innerHTML = `<div class="error-box">Digite o nome da turma.</div>`; return; }
    try {
      await api("/turmas", { method: "POST", body: JSON.stringify({ nome }) });
      renderTurmas();
    } catch (e) {
      erroEl.innerHTML = `<div class="error-box">${e.message}</div>`;
    }
  });

  content.querySelectorAll("[data-turma]").forEach((el) => {
    el.addEventListener("click", () => setView("turmaDetalhe", { turmaAtualId: el.dataset.turma }));
  });
}

/* ---------------- Turma — detalhe (alunos + TDEs) ---------------- */
async function renderTurmaDetalhe() {
  const turmaId = state.turmaAtualId;
  const [turmas, alunos, provas] = await Promise.all([
    api("/turmas"), api(`/alunos?turmaId=${turmaId}`), api(`/provas-mestre?turmaId=${turmaId}`),
  ]);
  const turma = turmas.find((t) => t.id === turmaId);
  if (!turma) { setView("turmas"); return; }

  content.innerHTML = `
    <div style="margin-bottom:6px;"><a href="#" id="voltar-turmas" class="mono muted" style="font-size:12px;">← Todas as turmas</a></div>
    <div class="eyebrow">TURMA</div>
    <div class="row" style="margin-bottom:20px; align-items:center;">
      <h1 id="turma-titulo">${turma.nome}</h1>
      <button class="btn subtle" id="btn-editar-turma" style="font-size:11px; padding:5px 10px;">Editar nome</button>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:start; margin-bottom:20px;">
      <div class="card">
        ${corners()}
        <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:12px;">Alunos matriculados (${alunos.length})</div>
        <div class="field">
          <label>Adicionar alunos (um nome por linha)</label>
          <textarea id="novos-alunos" placeholder="Ana Souza
Bruno Carvalho"></textarea>
        </div>
        <div id="erro-alunos"></div>
        <button class="btn subtle" id="btn-add-alunos">+ Adicionar</button>
        <div class="divider">
          ${alunos.length === 0 ? `<div class="muted" style="font-size:13px;">Nenhum aluno matriculado ainda.</div>` : ""}
          ${alunos.map((a, i) => `
            <div class="row" style="padding:8px 0; ${i>0?'border-top:1px solid var(--line-faint);':''}">
              <span style="font-size:13px;">${a.nome}</span>
              <button class="btn danger" style="padding:4px 8px; font-size:11px;" data-remover-aluno="${a.id}">Remover</button>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="card">
        ${corners()}
        <div class="row" style="margin-bottom:12px;">
          <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase;">TDEs desta turma (${provas.length})</div>
          <button class="btn subtle" id="btn-novo-tde" style="font-size:11px; padding:5px 10px;">+ Novo TDE</button>
        </div>
        ${provas.length === 0 ? `<div class="muted" style="font-size:13px;">Nenhum TDE criado ainda nesta turma.</div>` : ""}
        ${provas.map((p, i) => `
          <div style="padding:10px 0; ${i>0?'border-top:1px solid var(--line-faint);':''}">
            <div class="row">
              <div style="font-weight:600; font-size:13.5px;">${p.titulo}</div>
              <span class="pill ${p.status==='publicada'?'teal':''}">${p.status}</span>
            </div>
            <div class="row" style="margin-top:6px;">
              <span class="muted" style="font-size:11.5px;">${p.totalQuestoes} questões · ${p.totalAlunos} alunos</span>
              <div style="display:flex; gap:6px;">
                ${p.status==='publicada' ? `<button class="btn subtle" style="font-size:11px; padding:4px 8px;" data-ver-resultado-tde="${p.id}">Resultados</button>` : ""}
                <button class="btn danger" style="font-size:11px; padding:4px 8px;" data-apagar-tde="${p.id}">Apagar</button>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  document.getElementById("voltar-turmas").addEventListener("click", (e) => { e.preventDefault(); setView("turmas"); });
  document.getElementById("btn-editar-turma").addEventListener("click", async () => {
    const novoNome = prompt("Novo nome da turma:", turma.nome);
    if (novoNome === null) return; // cancelou
    if (!novoNome.trim()) { alert("O nome não pode ficar vazio."); return; }
    try {
      await api(`/turmas/${turmaId}`, { method: "PUT", body: JSON.stringify({ nome: novoNome.trim() }) });
      renderTurmaDetalhe();
    } catch (e) {
      alert("Erro ao renomear: " + e.message);
    }
  });
  document.getElementById("btn-novo-tde").addEventListener("click", () => {
    state.selecionadas = new Set();
    state.alunosSelecionados = new Set();
    state.publicarResultado = null;
    setView("montar");
  });

  document.getElementById("btn-add-alunos").addEventListener("click", async () => {
    const texto = document.getElementById("novos-alunos").value;
    const nomes = texto.split("\n").map((n) => n.trim()).filter(Boolean);
    const erroEl = document.getElementById("erro-alunos");
    if (nomes.length === 0) { erroEl.innerHTML = `<div class="error-box">Digite ao menos um nome.</div>`; return; }
    try {
      await api("/alunos", { method: "POST", body: JSON.stringify({ turmaId, nomes }) });
      renderTurmaDetalhe();
    } catch (e) {
      erroEl.innerHTML = `<div class="error-box">${e.message}</div>`;
    }
  });

  content.querySelectorAll("[data-remover-aluno]").forEach((el) => {
    el.addEventListener("click", async () => {
      if (!confirm("Remover este aluno da turma?")) return;
      try {
        await api(`/alunos/${el.dataset.removerAluno}`, { method: "DELETE" });
        renderTurmaDetalhe();
      } catch (e) {
        alert("Erro ao remover: " + e.message);
      }
    });
  });

  content.querySelectorAll("[data-ver-resultado-tde]").forEach((el) => {
    el.addEventListener("click", () => setView("resultados", { provaAtualId: el.dataset.verResultadoTde }));
  });

  content.querySelectorAll("[data-apagar-tde]").forEach((el) => {
    el.addEventListener("click", async () => {
      if (!confirm("Apagar este TDE? Isso também apaga todas as provas individuais e respostas geradas a partir dele. Não tem como desfazer.")) return;
      try {
        await api(`/provas-mestre/${el.dataset.apagarTde}`, { method: "DELETE" });
        renderTurmaDetalhe();
      } catch (e) {
        alert("Erro ao apagar: " + e.message);
      }
    });
  });
}

/* ---------------- Banco de Questões ---------------- */
async function renderBanco(mostrarForm) {
  const questoes = await api("/questoes");
  state.questoes = questoes;

  content.innerHTML = `
    <div class="row" style="align-items:flex-start; margin-bottom:16px;">
      <div><div class="eyebrow">BANCO DE QUESTÕES</div><h1 style="margin-bottom:0;">${questoes.length} questões cadastradas</h1></div>
      <button class="btn subtle" id="btn-nova-questao">${mostrarForm ? "Cancelar" : "+ Nova questão"}</button>
    </div>
    ${mostrarForm ? `<div id="form-questao" style="margin-bottom:18px;"></div>` : ""}
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
      <div>
        ${questoes.map((q) => `
          <div class="card" style="margin-bottom:10px; cursor:pointer;" data-questao="${q.id}">
            ${corners()}
            <div class="row">
              <div style="font-weight:600; font-size:13.5px;">${q.tema}</div>
              <div class="dots">${[1,2,3,4,5].map(i => `<div class="dot ${i<=q.dificuldade?'on':''}"></div>`).join("")}</div>
            </div>
            <div class="mono muted" style="font-size:11.5px; margin-top:8px; line-height:1.6;">${q.preview.enunciado}</div>
          </div>
        `).join("")}
        ${questoes.length === 0 ? `<div class="card muted" style="text-align:center; padding:30px; font-size:13px;">${corners()}Nenhuma questão cadastrada.</div>` : ""}
      </div>
      <div id="preview-pane">
        <div class="card muted" style="text-align:center; padding:40px; font-size:13px;">
          ${corners()}
          Clique em uma questão para ver a parametrização
        </div>
      </div>
    </div>
  `;

  document.getElementById("btn-nova-questao").addEventListener("click", () => renderBanco(!mostrarForm));
  if (mostrarForm) renderFormNovaQuestao(document.getElementById("form-questao"));

  content.querySelectorAll("[data-questao]").forEach((el) => {
    el.addEventListener("click", () => {
      const q = questoes.find((x) => x.id === el.dataset.questao);
      document.getElementById("preview-pane").innerHTML = `
        <div class="card accent-amber">
          ${corners()}
          <span class="pill amber">Preview parametrizado</span>
          <div style="font-weight:600; font-size:15px; margin-top:12px;">${q.tema}</div>
          <div style="font-size:13.5px; margin-top:10px; line-height:1.6;">${q.preview.enunciado}</div>
          <div class="divider mono muted" style="font-size:12px;">
            ${q.preview.erro
              ? `<div style="color:var(--red);">Erro na fórmula: ${q.preview.erro}</div>`
              : `<div>Resposta correta: <span style="color:var(--green);">${q.preview.respostaCorreta} ${q.unidade}</span></div>`}
            <div style="margin-top:4px;">Cada aluno recebe outros valores dentro das mesmas faixas — mesmo raciocínio, mesma dificuldade.</div>
          </div>
          <div style="margin-top:12px;"><button class="btn danger" data-remover="${q.id}">Remover questão</button></div>
        </div>
      `;
      document.querySelector("[data-remover]")?.addEventListener("click", async () => {
        if (!confirm("Remover esta questão do banco?")) return;
        try {
          await api(`/questoes/${q.id}`, { method: "DELETE" });
          renderBanco(false);
        } catch (e) {
          alert("Erro ao remover: " + e.message);
        }
      });
    });
  });
}

function renderFormNovaQuestao(container) {
  container.innerHTML = `
    <div class="card accent-teal">
      ${corners()}
      <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:14px;">Nova questão parametrizada</div>
      <div id="erro-questao"></div>
      <div class="field"><label>Tema</label><input id="nq-tema" placeholder="Ex: Cinemática — MRU" /></div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="field"><label>Dificuldade (1 a 5)</label><input id="nq-dificuldade" type="number" min="1" max="5" value="2" class="mono" /></div>
        <div class="field"><label>Unidade da resposta</label><input id="nq-unidade" placeholder="Ex: km/h" /></div>
      </div>
      <div class="field">
        <label>Enunciado (use {NOME} para cada variável)</label>
        <textarea id="nq-enunciado" placeholder="Ex: Um carro percorre {d} km em {t} horas. Qual a velocidade média?"></textarea>
      </div>
      <div class="field">
        <label>Letras gregas — clique num campo de texto abaixo e depois na letra pra inserir</label>
        <div id="paleta-grega" style="display:flex; flex-wrap:wrap; gap:4px;"></div>
      </div>
      <div class="field">
        <label>Variáveis</label>
        <div id="nq-vars"></div>
        <button class="btn subtle" id="nq-add-var" type="button">+ Adicionar variável</button>
      </div>
      <div class="field">
        <label>Fórmula da resposta correta (use os nomes das variáveis, ex: <code>d/t</code>)</label>
        <input id="nq-formula" class="mono" placeholder="Ex: d/t" />
        <div class="hint">Suporta + − × ÷ e parênteses. Ex.: <code>(C*i*t)/100</code></div>
      </div>
      <div style="display:flex; gap:10px; margin-top:6px;">
        <button class="btn subtle" id="nq-testar" type="button">Testar</button>
        <button class="btn" id="nq-salvar" type="button">Salvar questão</button>
      </div>
      <div id="nq-preview" style="margin-top:12px;"></div>
    </div>
  `;

  let campoAtivo = document.getElementById("nq-formula");
  container.addEventListener("focusin", (e) => {
    if (e.target.matches("input, textarea")) campoAtivo = e.target;
  });
  const LETRAS_GREGAS = ["α","β","γ","δ","ε","ζ","η","θ","ι","κ","λ","μ","ν","ξ","ο","π","ρ","σ","τ","υ","φ","χ","ψ","ω","Δ","Σ","Ω","Φ","Ψ","Θ","Λ","Π"];
  document.getElementById("paleta-grega").innerHTML = LETRAS_GREGAS.map((l) =>
    `<button type="button" class="btn subtle" data-letra-grega="${l}" style="padding:5px 10px; font-size:14px; font-family:var(--f-mono);">${l}</button>`
  ).join("");
  document.querySelectorAll("[data-letra-grega]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const el = campoAtivo;
      if (!el) return;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const ch = btn.dataset.letraGrega;
      el.value = el.value.slice(0, start) + ch + el.value.slice(end);
      el.selectionStart = el.selectionEnd = start + ch.length;
      el.focus();
    });
  });

  function renderVarRows() {
    document.getElementById("nq-vars").innerHTML = state.novaQuestaoVars.map((v, i) => `
      <div class="var-row">
        <input placeholder="nome (ex: F)" value="${v.nome}" data-vi="${i}" data-campo="nome" class="mono" />
        <input placeholder="min" type="number" value="${v.min}" data-vi="${i}" data-campo="min" class="mono" />
        <input placeholder="max" type="number" value="${v.max}" data-vi="${i}" data-campo="max" class="mono" />
        <input placeholder="decimais" type="number" value="${v.decimais}" data-vi="${i}" data-campo="decimais" class="mono" />
        <button class="btn danger" style="padding:5px 8px;" data-remove-var="${i}" type="button">×</button>
      </div>
    `).join("");
    document.querySelectorAll("[data-vi]").forEach((el) => {
      el.addEventListener("input", () => {
        const i = Number(el.dataset.vi), campo = el.dataset.campo;
        state.novaQuestaoVars[i][campo] = campo === "nome" ? el.value.trim() : Number(el.value);
      });
    });
    document.querySelectorAll("[data-remove-var]").forEach((el) => {
      el.addEventListener("click", () => {
        state.novaQuestaoVars.splice(Number(el.dataset.removeVar), 1);
        renderVarRows();
      });
    });
  }
  renderVarRows();

  document.getElementById("nq-add-var").addEventListener("click", () => {
    state.novaQuestaoVars.push({ nome: "", min: 0, max: 10, decimais: 0 });
    renderVarRows();
  });

  function coletarQuestao() {
    return {
      tema: document.getElementById("nq-tema").value.trim(),
      dificuldade: Number(document.getElementById("nq-dificuldade").value),
      unidade: document.getElementById("nq-unidade").value.trim(),
      enunciado: document.getElementById("nq-enunciado").value.trim(),
      variaveis: state.novaQuestaoVars.filter((v) => v.nome),
      formula: document.getElementById("nq-formula").value.trim(),
    };
  }

  document.getElementById("nq-testar").addEventListener("click", async () => {
    const q = coletarQuestao();
    const erroEl = document.getElementById("erro-questao");
    const previewEl = document.getElementById("nq-preview");
    erroEl.innerHTML = "";
    previewEl.innerHTML = "";
    if (!q.tema || !q.enunciado || !q.formula || q.variaveis.length === 0) {
      erroEl.innerHTML = `<div class="error-box">Preencha tema, enunciado, ao menos uma variável e a fórmula.</div>`;
      return;
    }
    try {
      const resultado = await api("/questoes/testar", { method: "POST", body: JSON.stringify(q) });
      previewEl.innerHTML = `<div class="ok-box">
        <div style="margin-bottom:6px;">${resultado.enunciado}</div>
        <div>Resposta correta: ${resultado.respostaCorreta} ${q.unidade}</div>
      </div>`;
    } catch (e) {
      erroEl.innerHTML = `<div class="error-box">${e.message}</div>`;
    }
  });

  document.getElementById("nq-salvar").addEventListener("click", async () => {
    const q = coletarQuestao();
    const erroEl = document.getElementById("erro-questao");
    erroEl.innerHTML = "";
    if (!q.tema || !q.enunciado || !q.formula || q.variaveis.length === 0) {
      erroEl.innerHTML = `<div class="error-box">Preencha tema, enunciado, ao menos uma variável e a fórmula.</div>`;
      return;
    }
    try {
      await api("/questoes", { method: "POST", body: JSON.stringify(q) });
      state.novaQuestaoVars = [{ nome: "", min: 0, max: 10, decimais: 0 }, { nome: "", min: 0, max: 10, decimais: 0 }];
      renderBanco(false);
    } catch (e) {
      erroEl.innerHTML = `<div class="error-box">${e.message}</div>`;
    }
  });
}

/* ---------------- Novo TDE (dentro de uma turma) ---------------- */
async function renderMontar() {
  if (!state.turmaAtualId) { setView("turmas"); return; }
  if (state.publicarResultado) return renderMontarSucesso();

  const [turmas, questoes, alunos] = await Promise.all([
    api("/turmas"), api("/questoes"), api(`/alunos?turmaId=${state.turmaAtualId}`),
  ]);
  const turma = turmas.find((t) => t.id === state.turmaAtualId);
  if (!turma) { setView("turmas"); return; }

  if (state.selecionadas.size === 0) questoes.slice(0, 4).forEach((q) => state.selecionadas.add(q.id));
  if (state.alunosSelecionados.size === 0) alunos.forEach((a) => state.alunosSelecionados.add(a.id));

  if (alunos.length === 0) {
    content.innerHTML = `<div class="card muted" style="text-align:center; padding:36px; font-size:13px;">${corners()}
      A turma <b style="color:var(--ink);">${turma.nome}</b> ainda não tem alunos matriculados.
      <a href="#" id="link-turma" style="color:var(--teal); text-decoration:underline;">Voltar e matricular alunos</a> antes de criar um TDE.
    </div>`;
    document.getElementById("link-turma").addEventListener("click", (e) => { e.preventDefault(); setView("turmaDetalhe"); });
    return;
  }

  content.innerHTML = `
    <div style="margin-bottom:6px;"><a href="#" id="voltar-turma" class="mono muted" style="font-size:12px;">← ${turma.nome}</a></div>
    <div class="eyebrow">NOVO TDE</div>
    <h1 style="margin-bottom:20px;">${turma.nome}</h1>
    <div style="display:grid; grid-template-columns:1.3fr 1fr; gap:16px; align-items:start;">
      <div>
        <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:10px;">Questões (${state.selecionadas.size} selecionadas)</div>
        <div id="lista-questoes">
          ${questoes.map((q) => `
            <div class="list-item ${state.selecionadas.has(q.id) ? "checked" : ""}" data-toggle-questao="${q.id}">
              <div class="checkbox ${state.selecionadas.has(q.id) ? "on" : ""}">${state.selecionadas.has(q.id) ? "✓" : ""}</div>
              <div style="flex:1;"><div style="font-weight:600; font-size:13.5px;">${q.tema}</div></div>
              <div class="dots">${[1,2,3,4,5].map(i => `<div class="dot ${i<=q.dificuldade?'on':''}"></div>`).join("")}</div>
            </div>
          `).join("")}
        </div>

        <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin:18px 0 10px;">Alunos (${state.alunosSelecionados.size} de ${alunos.length} selecionados)</div>
        <div class="row" style="margin-bottom:8px;">
          <button class="btn subtle" id="btn-marcar-todos" style="font-size:11px; padding:5px 10px;">Marcar todos</button>
          <button class="btn subtle" id="btn-desmarcar-todos" style="font-size:11px; padding:5px 10px;">Desmarcar todos</button>
        </div>
        <div id="lista-alunos">
          ${alunos.map((a) => `
            <div class="list-item ${state.alunosSelecionados.has(a.id) ? "checked" : ""}" data-toggle-aluno="${a.id}">
              <div class="checkbox ${state.alunosSelecionados.has(a.id) ? "on" : ""}">${state.alunosSelecionados.has(a.id) ? "✓" : ""}</div>
              <div style="flex:1;"><div style="font-weight:600; font-size:13.5px;">${a.nome}</div></div>
            </div>
          `).join("")}
        </div>
      </div>
      <div class="card">
        ${corners()}
        <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:14px;">Configuração</div>
        <div class="field">
          <label>Título do TDE</label>
          <input id="titulo" value="TDE 1" />
        </div>
        <div class="field">
          <label>Duração (minutos)</label>
          <input id="duracao" class="mono" type="number" value="50" />
        </div>
        <div id="erro-publicar"></div>
        <button class="btn" id="btn-publicar" style="width:100%; justify-content:center;" ${state.selecionadas.size === 0 || state.alunosSelecionados.size === 0 ? "disabled" : ""}>
          Publicar e gerar ${state.alunosSelecionados.size} provas individuais
        </button>
      </div>
    </div>
  `;

  document.getElementById("voltar-turma").addEventListener("click", (e) => { e.preventDefault(); setView("turmaDetalhe"); });

  content.querySelectorAll("[data-toggle-questao]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.toggleQuestao;
      state.selecionadas.has(id) ? state.selecionadas.delete(id) : state.selecionadas.add(id);
      renderMontar();
    });
  });
  content.querySelectorAll("[data-toggle-aluno]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.toggleAluno;
      state.alunosSelecionados.has(id) ? state.alunosSelecionados.delete(id) : state.alunosSelecionados.add(id);
      renderMontar();
    });
  });
  document.getElementById("btn-marcar-todos").addEventListener("click", () => {
    alunos.forEach((a) => state.alunosSelecionados.add(a.id));
    renderMontar();
  });
  document.getElementById("btn-desmarcar-todos").addEventListener("click", () => {
    state.alunosSelecionados.clear();
    renderMontar();
  });

  document.getElementById("btn-publicar").addEventListener("click", async (e) => {
    e.target.disabled = true;
    e.target.textContent = "Gerando provas…";
    const erroEl = document.getElementById("erro-publicar");
    try {
      const titulo = document.getElementById("titulo").value;
      const duracaoMinutos = Number(document.getElementById("duracao").value);
      const questaoIds = Array.from(state.selecionadas);
      const alunoIds = Array.from(state.alunosSelecionados);

      const provaMestre = await api("/provas-mestre", {
        method: "POST",
        body: JSON.stringify({ titulo, turmaId: state.turmaAtualId, duracaoMinutos, questaoIds }),
      });
      const resultado = await api(`/provas-mestre/${provaMestre.id}/publicar`, {
        method: "POST",
        body: JSON.stringify({ alunoIds }),
      });
      state.provaAtualId = provaMestre.id;
      state.publicarResultado = resultado;
      state.selecionadas = new Set();
      render();
    } catch (err) {
      erroEl.innerHTML = `<div class="error-box">Erro ao publicar: ${err.message}</div>`;
      e.target.disabled = false;
      e.target.textContent = "Publicar e gerar provas";
    }
  });
}

function renderMontarSucesso() {
  const r = state.publicarResultado;
  content.innerHTML = `
    <div class="seal" style="margin-bottom:16px;">✓ TDE PUBLICADO · EQUIVALÊNCIA VERIFICADA</div>
    <h1 style="margin-bottom:20px;">TDE publicado</h1>
    <div class="card accent-teal" style="margin-bottom:20px;">
      ${corners()}
      <div class="grid-stats">
        <div><div class="stat-label">Provas geradas</div><div class="stat-value">${r.totalGeradas}<small>alunos</small></div></div>
      </div>
      <div class="divider" style="font-size:13px; color:var(--ink-muted); line-height:1.6;">
        Cada aluno recebeu uma prova individual: mesmas questões, ordem embaralhada, valores numéricos e alternativas
        recalculados. Um <span class="mono" style="color:var(--teal);">seed</span> único por aluno garante que a geração seja auditável.
      </div>
    </div>
    <div class="card">
      ${corners()}
      <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:12px;">Links individuais</div>
      ${r.provas.map((p) => `
        <div class="row" style="padding:8px 0; border-top:1px solid var(--line-faint);">
          <span style="font-size:13px;">${p.alunoNome}</span>
          <a href="/aluno.html?token=${p.qrToken}" target="_blank" class="btn subtle" style="padding:5px 10px; font-size:12px;">Abrir prova →</a>
        </div>
      `).join("")}
    </div>
    <button class="btn ghost" style="margin-top:20px;" id="btn-voltar-turma">Voltar à turma</button>
  `;
  document.getElementById("btn-voltar-turma").addEventListener("click", () => {
    state.publicarResultado = null;
    setView("turmaDetalhe");
  });
}

/* ---------------- Resultados ---------------- */
async function renderResultados() {
  const provas = await api("/provas-mestre");
  const publicadas = provas.filter((p) => p.status === "publicada");

  if (publicadas.length === 0) {
    content.innerHTML = `<div class="card muted" style="text-align:center; padding:40px; font-size:13px;">
      ${corners()}
      Nenhum TDE publicado ainda. Crie um dentro de uma turma.</div>`;
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
      <h1>${provaSel.titulo} <span class="muted" style="font-size:15px; font-weight:400;">— ${provaSel.turmaNome}</span></h1>
      <select id="select-prova" class="mono" style="background:var(--surface-raised); border:1px solid var(--line); color:var(--ink); padding:6px 10px; font-size:12px;">
        ${publicadas.map((p) => `<option value="${p.id}" ${p.id === state.provaAtualId ? "selected" : ""}>${p.turmaNome} — ${p.titulo}</option>`).join("")}
      </select>
    </div>

    <div class="grid-stats" style="margin-bottom:14px;">
      <div class="card">${corners()}<div class="stat-label">Média</div><div class="stat-value">${r.media ?? "—"}</div></div>
      <div class="card">${corners()}<div class="stat-label">Mediana</div><div class="stat-value">${r.mediana ?? "—"}</div></div>
      <div class="card">${corners()}<div class="stat-label">Desvio padrão</div><div class="stat-value">${r.desvioPadrao ?? "—"}</div></div>
    </div>

    <div class="card" style="margin-bottom:14px;">
      ${corners()}
      <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:10px;">⚠ Questões com mais erro</div>
      ${r.rankingErros.length === 0 ? `<div class="muted" style="font-size:12.5px;">Ainda sem respostas suficientes.</div>` : r.rankingErros.slice(0,4).map((q) => `
        <div style="margin-bottom:10px;">
          <div class="row" style="font-size:12.5px; margin-bottom:4px;"><span class="muted">${q.tema}</span><span class="mono" style="color:var(--amber);">${q.percentualErro}%</span></div>
          <div style="height:4px; background:var(--line-faint);"><div style="height:4px; width:${q.percentualErro}%; background:var(--amber);"></div></div>
        </div>
      `).join("")}
    </div>

    <div class="card">
      ${corners()}
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
