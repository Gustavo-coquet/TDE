const state = {
  view: "dashboard",
  provas: [],
  questoes: [],
  alunos: [],
  selecionadas: new Set(),
  alunosSelecionados: new Set(),
  provaAtualId: null,
  publicarResultado: null,
  novaQuestaoVars: [{ nome: "", min: 0, max: 10, decimais: 0 }, { nome: "", min: 0, max: 10, decimais: 0 }],
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
    else if (state.view === "banco") await renderBanco();
    else if (state.view === "alunos") await renderAlunos();
    else if (state.view === "montar") await renderMontar();
    else if (state.view === "resultados") await renderResultados();
  } catch (e) {
    content.innerHTML = `<div class="error-box">Erro: ${e.message}. Confira se o backend está rodando e o banco foi migrado.</div>`;
  }
}

/* ---------------- Dashboard ---------------- */
async function renderDashboard() {
  const provas = await api("/provas-mestre");
  state.provas = provas;
  const questoes = await api("/questoes");
  const alunos = await api("/alunos");

  content.innerHTML = `
    <div class="eyebrow">PAINEL DO PROFESSOR</div>
    <h1 style="margin-bottom:20px;">Provas-Mestre cadastradas</h1>

    <div class="grid-stats" style="margin-bottom:20px;">
      <div class="card">${corners()}<div class="stat-label">Provas-mestre</div><div class="stat-value">${provas.length}</div></div>
      <div class="card">${corners()}<div class="stat-label">Publicadas</div><div class="stat-value">${provas.filter(p=>p.status==='publicada').length}</div></div>
      <div class="card">${corners()}<div class="stat-label">Questões no banco</div><div class="stat-value">${questoes.length}</div></div>
      <div class="card">${corners()}<div class="stat-label">Alunos cadastrados</div><div class="stat-value">${alunos.length}</div></div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      ${corners()}
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

    <div style="display:flex; gap:10px;">
      <button class="btn" id="btn-nova-prova">+ Nova Prova-Mestre</button>
      ${alunos.length === 0 ? `<button class="btn ghost" id="btn-ir-alunos">Cadastrar alunos primeiro</button>` : ""}
    </div>
  `;

  document.getElementById("btn-nova-prova").addEventListener("click", () => setView("montar"));
  document.getElementById("btn-ir-alunos")?.addEventListener("click", () => setView("alunos"));
  content.querySelectorAll("[data-ver-resultado]").forEach((el) => {
    el.addEventListener("click", () => {
      state.provaAtualId = el.dataset.verResultado;
      setView("resultados");
    });
  });
}
