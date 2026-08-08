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
  novaQuestaoEtapas: [{ nome: "", formula: "", decimais: 2, unidade: "", saida: true }],
  editandoQuestaoId: null,
  editandoQuestaoDados: null,
  novaQuestaoImagem: null,
  filtroBanco: { disciplina: "", assunto: "", busca: "" },
  filtroMontar: { disciplina: "", assunto: "", busca: "" },
  alunosSelecionadosInicializado: false,
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

function disciplinasDe(questoes) {
  return Array.from(new Set(questoes.map((q) => q.disciplina))).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function assuntosDe(questoes, disciplina) {
  const base = disciplina ? questoes.filter((q) => q.disciplina === disciplina) : questoes;
  return Array.from(new Set(base.map((q) => q.assunto))).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function aplicarFiltro(questoes, filtro) {
  const busca = filtro.busca.trim().toLowerCase();
  return questoes.filter((q) => {
    if (filtro.disciplina && q.disciplina !== filtro.disciplina) return false;
    if (filtro.assunto && q.assunto !== filtro.assunto) return false;
    if (busca && !(`${q.disciplina} ${q.assunto} ${q.enunciado}`.toLowerCase().includes(busca))) return false;
    return true;
  });
}

// monta a barra de filtros (Disciplina / Assunto / busca) reutilizada no Banco e no Novo TDE
function renderBarraFiltro(idPrefix, questoes, filtro) {
  const disciplinas = disciplinasDe(questoes);
  const assuntos = assuntosDe(questoes, filtro.disciplina);
  return `
    <div style="display:grid; grid-template-columns:1fr 1fr 1.4fr; gap:8px; margin-bottom:14px;">
      <select id="${idPrefix}-disciplina" style="background:var(--surface-raised); border:1px solid var(--line); color:var(--ink); padding:7px 8px; font-size:12.5px;">
        <option value="">Todas as disciplinas</option>
        ${disciplinas.map((d) => `<option value="${d}" ${filtro.disciplina===d?"selected":""}>${d}</option>`).join("")}
      </select>
      <select id="${idPrefix}-assunto" style="background:var(--surface-raised); border:1px solid var(--line); color:var(--ink); padding:7px 8px; font-size:12.5px;">
        <option value="">Todos os assuntos</option>
        ${assuntos.map((a) => `<option value="${a}" ${filtro.assunto===a?"selected":""}>${a}</option>`).join("")}
      </select>
      <input id="${idPrefix}-busca" placeholder="Buscar no enunciado…" value="${filtro.busca}" style="background:var(--surface-raised); border:1px solid var(--line); color:var(--ink); padding:7px 10px; font-size:12.5px;" />
    </div>
  `;
}

function ligarBarraFiltro(idPrefix, filtro, onChange) {
  document.getElementById(`${idPrefix}-disciplina`).addEventListener("change", (e) => {
    filtro.disciplina = e.target.value;
    filtro.assunto = ""; // muda a disciplina, reseta o assunto selecionado
    onChange();
  });
  document.getElementById(`${idPrefix}-assunto`).addEventListener("change", (e) => {
    filtro.assunto = e.target.value;
    onChange();
  });
  let debounce;
  document.getElementById(`${idPrefix}-busca`).addEventListener("input", (e) => {
    const cursorPos = e.target.selectionStart;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      filtro.busca = e.target.value;
      onChange();
      const novoInput = document.getElementById(`${idPrefix}-busca`);
      if (novoInput) { novoInput.focus(); novoInput.setSelectionRange(cursorPos, cursorPos); }
    }, 250);
  });
}

function formatarBR(n) {
  return String(Number(n)).replace(".", ","); // só vírgula decimal, sem separador de milhar
}

// campos de etapas de texto (ex.: "1º quadrante", vindo de um se(...)) devem aparecer do jeito
// que estão, sem tentar formatar como número
function formatarValorCampo(valor) {
  return typeof valor === "string" ? valor : formatarBR(valor);
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
          <label>Adicionar alunos — cole "Matrícula, Nome", um por linha (funciona com TAB, vírgula ou ponto-e-vírgula)</label>
          <textarea id="novos-alunos" placeholder="2023001, Ana Souza
2023002, Bruno Carvalho"></textarea>
        </div>
        <div id="erro-alunos"></div>
        <button class="btn subtle" id="btn-add-alunos">+ Adicionar</button>
        <div class="divider">
          ${alunos.length === 0 ? `<div class="muted" style="font-size:13px;">Nenhum aluno matriculado ainda.</div>` : ""}
          ${alunos.map((a, i) => `
            <div class="row" style="padding:8px 0; ${i>0?'border-top:1px solid var(--line-faint);':''}">
              <span style="font-size:13px;">${a.nome} <span class="mono muted" style="font-size:11px;">— matrícula ${a.matricula}</span></span>
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
              <span class="muted" style="font-size:11.5px;">${p.totalQuestoes} questões · vale ${p.valor} pts · ${p.totalAlunos} alunos${p.prazoFinal ? ` · prazo até ${new Date(p.prazoFinal).toLocaleDateString("pt-BR")}` : ""}</span>
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                ${p.status==='publicada' ? `<button class="btn subtle" style="font-size:11px; padding:4px 8px;" data-add-alunos-tde="${p.id}">+ Alunos novos</button>` : ""}
                ${p.status==='publicada' ? `<button class="btn subtle" style="font-size:11px; padding:4px 8px;" data-ver-links-tde="${p.id}">Ver links</button>` : ""}
                ${p.status==='publicada' ? `<button class="btn subtle" style="font-size:11px; padding:4px 8px;" data-ver-resultado-tde="${p.id}">Resultados</button>` : ""}
                <button class="btn danger" style="font-size:11px; padding:4px 8px;" data-apagar-tde="${p.id}">Apagar</button>
              </div>
            </div>
            <div id="add-alunos-tde-${p.id}"></div>
            <div id="links-tde-${p.id}"></div>
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
    state.alunosSelecionadosInicializado = false;
    state.publicarResultado = null;
    setView("montar");
  });

  document.getElementById("btn-add-alunos").addEventListener("click", async () => {
    const texto = document.getElementById("novos-alunos").value;
    const erroEl = document.getElementById("erro-alunos");

    const alunosColados = texto.split("\n").map((linha) => linha.trim()).filter(Boolean).map((linha) => {
      // aceita colar do Excel (separado por TAB) ou digitado com vírgula/ponto-e-vírgula — ordem: matrícula, nome
      const partes = linha.split(/\t|,|;/).map((p) => p.trim()).filter(Boolean);
      return { matricula: partes[0] || "", nome: partes[1] || "" };
    });

    if (alunosColados.length === 0) { erroEl.innerHTML = `<div class="error-box">Cole ao menos uma linha com nome e matrícula.</div>`; return; }
    if (alunosColados.some((a) => !a.nome || !a.matricula)) {
      erroEl.innerHTML = `<div class="error-box">Cada linha precisa ter nome E matrícula, separados por vírgula (ou colados do Excel).</div>`;
      return;
    }

    try {
      const resultado = await api("/alunos", { method: "POST", body: JSON.stringify({ turmaId, alunos: alunosColados }) });
      renderTurmaDetalhe();
      if (resultado.erros && resultado.erros.length > 0) {
        alert("Alguns alunos não foram adicionados:\n\n" + resultado.erros.join("\n"));
      }
    } catch (e) {
      erroEl.innerHTML = `<div class="error-box">${e.message}</div>`;
    }
  });

  content.querySelectorAll("[data-remover-aluno]").forEach((el) => {
    el.addEventListener("click", async () => {
      if (!confirm("Remover este aluno da turma?")) return;
      try {
        await api(`/alunos/${el.dataset.removerAluno}`, { method: "DELETE", body: JSON.stringify({}) });
        renderTurmaDetalhe();
      } catch (e) {
        if (e.message && e.message.toLowerCase().includes("senha")) {
          if (!confirm("⚠ Este aluno já respondeu algum TDE. Se você apagar, todo o histórico de respostas e notas dele nesse(s) TDE(s) será perdido pra sempre. Quer continuar mesmo assim?")) return;
          const senha = prompt("Digite a senha do professor para confirmar:");
          if (senha === null) return;
          try {
            await api(`/alunos/${el.dataset.removerAluno}`, { method: "DELETE", body: JSON.stringify({ senha }) });
            renderTurmaDetalhe();
          } catch (e2) {
            alert("Erro ao remover: " + e2.message);
          }
        } else {
          alert("Erro ao remover: " + e.message);
        }
      }
    });
  });

  content.querySelectorAll("[data-ver-resultado-tde]").forEach((el) => {
    el.addEventListener("click", () => setView("resultados", { provaAtualId: el.dataset.verResultadoTde }));
  });

  content.querySelectorAll("[data-add-alunos-tde]").forEach((el) => {
    el.addEventListener("click", async () => {
      const provaId = el.dataset.addAlunosTde;
      const alvo = document.getElementById(`add-alunos-tde-${provaId}`);
      if (alvo.innerHTML) { alvo.innerHTML = ""; return; } // clique de novo fecha
      alvo.innerHTML = `<div class="muted mono" style="font-size:11px; padding:8px 0;">Carregando…</div>`;
      try {
        const links = await api(`/provas-mestre/${provaId}/links`);
        const idsComProva = new Set(links.map((l) => l.alunoId));
        const faltando = alunos.filter((a) => !idsComProva.has(a.id));

        if (faltando.length === 0) {
          alvo.innerHTML = `<div class="ok-box" style="margin-top:8px;">Todos os alunos da turma já têm prova gerada neste TDE.</div>`;
          return;
        }

        alvo.innerHTML = `
          <div style="margin-top:8px; padding:10px; background:var(--surface-raised); border:1px solid var(--line-faint);">
            <div class="mono muted" style="font-size:10.5px; margin-bottom:8px; text-transform:uppercase;">Alunos da turma que ainda não têm prova neste TDE (${faltando.length})</div>
            ${faltando.map((a) => `
              <label style="display:flex; align-items:center; gap:8px; padding:5px 0; font-size:12.5px; cursor:pointer;">
                <input type="checkbox" class="chk-add-aluno" value="${a.id}" checked style="width:auto;" /> ${a.nome}
              </label>
            `).join("")}
            <div id="erro-add-alunos" style="margin-top:6px;"></div>
            <button class="btn" id="btn-confirmar-add-alunos" style="margin-top:10px; font-size:12px; padding:6px 12px;">Gerar prova pra selecionados</button>
          </div>
        `;

        document.getElementById("btn-confirmar-add-alunos").addEventListener("click", async (ev) => {
          const selecionados = Array.from(document.querySelectorAll(".chk-add-aluno:checked")).map((c) => c.value);
          const erroEl = document.getElementById("erro-add-alunos");
          if (selecionados.length === 0) { erroEl.innerHTML = `<div class="error-box">Selecione ao menos um aluno.</div>`; return; }
          ev.target.disabled = true;
          ev.target.textContent = "Gerando…";
          try {
            await api(`/provas-mestre/${provaId}/adicionar-alunos`, { method: "POST", body: JSON.stringify({ alunoIds: selecionados }) });
            alvo.innerHTML = "";
            renderTurmaDetalhe();
          } catch (e) {
            erroEl.innerHTML = `<div class="error-box">${e.message}</div>`;
            ev.target.disabled = false;
            ev.target.textContent = "Gerar prova pra selecionados";
          }
        });
      } catch (e) {
        alvo.innerHTML = `<div class="error-box" style="margin-top:8px;">Erro ao carregar: ${e.message}</div>`;
      }
    });
  });

  content.querySelectorAll("[data-ver-links-tde]").forEach((el) => {
    el.addEventListener("click", async () => {
      const provaId = el.dataset.verLinksTde;
      const alvo = document.getElementById(`links-tde-${provaId}`);
      if (alvo.innerHTML) { alvo.innerHTML = ""; return; } // clique de novo fecha
      alvo.innerHTML = `<div class="muted mono" style="font-size:11px; padding:8px 0;">Carregando…</div>`;
      try {
        const links = await api(`/provas-mestre/${provaId}/links`);
        const linkTurma = `${window.location.origin}/aluno.html?prova=${provaId}`;
        alvo.innerHTML = `
          <div style="margin-top:8px; padding:10px; background:var(--surface-raised); border:1px solid var(--line-faint);">
            <div class="mono muted" style="font-size:10.5px; margin-bottom:6px; text-transform:uppercase;">Link pra passar pra turma inteira (poste uma vez no Classroom/quadro)</div>
            <div class="row" style="margin-bottom:12px; gap:8px;">
              <input readonly value="${linkTurma}" class="mono" style="flex:1; padding:6px 8px; font-size:11.5px; background:var(--surface); border:1px solid var(--line); color:var(--teal);" onclick="this.select()" />
              <button class="btn subtle" style="padding:6px 10px; font-size:11px;" data-copiar-link="${linkTurma}">Copiar</button>
            </div>
            <div class="mono muted" style="font-size:10.5px; margin-bottom:8px;">Cada aluno digita a própria matrícula pra entrar. Referência (matrícula = código):</div>
            ${links.map((l) => `
              <div class="row" style="padding:5px 0;">
                <span style="font-size:12px;">${l.alunoNome}</span>
                <span class="mono" style="font-size:13px; color:var(--teal); letter-spacing:.05em;">${l.qrToken}</span>
              </div>
            `).join("")}
          </div>
        `;
        document.querySelector(`[data-copiar-link="${linkTurma}"]`)?.addEventListener("click", (ev) => {
          navigator.clipboard.writeText(linkTurma);
          ev.target.textContent = "Copiado!";
          setTimeout(() => { ev.target.textContent = "Copiar"; }, 1500);
        });
      } catch (e) {
        alvo.innerHTML = `<div class="error-box" style="margin-top:8px;">Erro ao carregar links: ${e.message}</div>`;
      }
    });
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
  const filtradas = aplicarFiltro(questoes, state.filtroBanco);

  content.innerHTML = `
    <div class="row" style="align-items:flex-start; margin-bottom:16px;">
      <div><div class="eyebrow">BANCO DE QUESTÕES</div><h1 style="margin-bottom:0;">${questoes.length} questões cadastradas</h1></div>
      <button class="btn subtle" id="btn-nova-questao">${mostrarForm ? "Cancelar" : "+ Nova questão"}</button>
    </div>
    ${mostrarForm ? `<div id="form-questao" style="margin-bottom:18px;"></div>` : ""}
    ${renderBarraFiltro("banco", questoes, state.filtroBanco)}
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
      <div>
        <div class="mono muted" style="font-size:11px; margin-bottom:8px;">${filtradas.length} de ${questoes.length} questões</div>
        ${filtradas.map((q) => `
          <div class="card" style="margin-bottom:10px; cursor:pointer;" data-questao="${q.id}">
            ${corners()}
            <div class="row">
              <div>
                <span class="pill" style="margin-bottom:6px;">${q.disciplina}</span>
                <div style="font-weight:600; font-size:13.5px; margin-top:6px;">${q.assunto}</div>
              </div>
              <div class="dots">${[1,2,3,4,5].map(i => `<div class="dot ${i<=q.dificuldade?'on':''}"></div>`).join("")}</div>
            </div>
            <div class="mono muted" style="font-size:11.5px; margin-top:8px; line-height:1.6;">${q.preview.enunciado}</div>
          </div>
        `).join("")}
        ${filtradas.length === 0 ? `<div class="card muted" style="text-align:center; padding:30px; font-size:13px;">${corners()}Nenhuma questão encontrada com esse filtro.</div>` : ""}
      </div>
      <div id="preview-pane">
        <div class="card muted" style="text-align:center; padding:40px; font-size:13px;">
          ${corners()}
          Clique em uma questão para ver a parametrização
        </div>
      </div>
    </div>
  `;

  ligarBarraFiltro("banco", state.filtroBanco, () => renderBanco(false));

  document.getElementById("btn-nova-questao").addEventListener("click", () => {
    state.editandoQuestaoId = null;
    state.editandoQuestaoDados = null;
    state.novaQuestaoVars = [{ nome: "", min: 0, max: 10, decimais: 0 }, { nome: "", min: 0, max: 10, decimais: 0 }];
    state.novaQuestaoEtapas = [{ nome: "", formula: "", decimais: 2, unidade: "", saida: true }];
    state.novaQuestaoImagem = null;
    renderBanco(!mostrarForm);
  });
  if (mostrarForm) renderFormNovaQuestao(document.getElementById("form-questao"));

  content.querySelectorAll("[data-questao]").forEach((el) => {
    el.addEventListener("click", () => {
      const q = questoes.find((x) => x.id === el.dataset.questao);
      document.getElementById("preview-pane").innerHTML = `
        <div class="card accent-amber">
          ${corners()}
          <span class="pill amber">Preview parametrizado</span>
          <div class="mono muted" style="font-size:11px; margin-top:12px;">${q.disciplina}</div>
          <div style="font-weight:600; font-size:15px; margin-top:2px;">${q.assunto}</div>
          ${q.imagem ? `<img src="${q.imagem}" style="max-width:min(100%, 360px); max-height:260px; width:auto; height:auto; display:block; margin-top:10px; border:1px solid var(--line-faint);" />` : ""}
          <div style="font-size:13.5px; margin-top:10px; line-height:1.6;">${q.preview.enunciado}</div>
          ${q.preview.erro
            ? `<div class="mono" style="color:var(--red); font-size:12px; margin-top:10px;">Erro: ${q.preview.erro}</div>`
            : `<div style="margin-top:12px;">${renderAlternativasPreview(q.preview.alternativas, q.formatoResposta)}</div>`}
          <div class="divider mono muted" style="font-size:11px;">Cada aluno recebe outros valores dentro das mesmas faixas — mesmo raciocínio, mesma dificuldade.</div>
          <div style="margin-top:12px; display:flex; gap:8px;">
            <button class="btn subtle" data-editar="${q.id}">Editar questão</button>
            <button class="btn danger" data-remover="${q.id}">Remover questão</button>
          </div>
        </div>
      `;
      document.querySelector("[data-editar]")?.addEventListener("click", () => {
        state.editandoQuestaoId = q.id;
        state.editandoQuestaoDados = { disciplina: q.disciplina, assunto: q.assunto, dificuldade: q.dificuldade, enunciado: q.enunciado, formatoResposta: q.formatoResposta };
        state.novaQuestaoVars = JSON.parse(JSON.stringify(q.variaveis));
        state.novaQuestaoEtapas = JSON.parse(JSON.stringify(q.etapas));
        state.novaQuestaoImagem = q.imagem || null;
        renderBanco(true);
      });
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

// monta o texto de uma alternativa combinando todos os campos (ex.: "I=29947.5 cm⁴, σ=0.145 kN/cm²")
// se "formato" for informado (ex.: "F = ({Fx}î + {Fz}k̂) N"), usa ele pra montar uma expressão única
// SÓ pros campos que ele realmente referencia — outros campos marcados como "é resposta" que não
// aparecem no formato continuam sendo mostrados do jeito padrão, do lado.
function textoAlternativa(campos, formato) {
  if (formato) {
    let out = formato;
    const usados = new Set();
    campos.forEach((c) => {
      if (out.includes(`{${c.nome}}`)) {
        out = out.split(`{${c.nome}}`).join(formatarValorCampo(c.valor));
        usados.add(c.nome);
      }
    });
    const restantes = campos.filter((c) => !usados.has(c.nome));
    const textoRestante = restantes.map((c) => `${c.nome} = ${formatarValorCampo(c.valor)} ${c.unidade}`).join("   |   ");
    return textoRestante ? `${out}   |   ${textoRestante}` : out;
  }
  return campos.map((c) => `${c.nome} = ${formatarValorCampo(c.valor)} ${c.unidade}`).join("   |   ");
}

function renderAlternativasPreview(alternativas, formato) {
  return `<div style="display:flex; flex-direction:column; gap:6px;">
    ${alternativas.map((a) => `
      <div class="mono" style="font-size:12px; padding:6px 8px; ${a.correta ? 'background:rgba(127,216,143,.1); color:var(--green); border:1px solid #3E6B45;' : 'color:var(--ink-muted); border:1px solid var(--line-faint);'}">
        ${a.letra}) ${textoAlternativa(a.campos, formato)} ${a.correta ? "← correta" : ""}
      </div>
    `).join("")}
  </div>`;
}

function renderFormNovaQuestao(container) {
  const editando = !!state.editandoQuestaoId;
  const dados = state.editandoQuestaoDados || { disciplina: "", assunto: "", dificuldade: 2, enunciado: "", formatoResposta: "" };
  const disciplinasExistentes = disciplinasDe(state.questoes || []);
  const assuntosExistentes = assuntosDe(state.questoes || [], "");
  container.innerHTML = `
    <div class="card accent-teal">
      ${corners()}
      <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:14px;">${editando ? "Editar questão" : "Nova questão parametrizada"}</div>
      <div id="erro-questao"></div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="field">
          <label>Disciplina</label>
          <input id="nq-disciplina" value="${dados.disciplina}" placeholder="Ex: Resistência dos Materiais" list="lista-disciplinas" />
          <datalist id="lista-disciplinas">${disciplinasExistentes.map((d) => `<option value="${d}">`).join("")}</datalist>
        </div>
        <div class="field">
          <label>Assunto</label>
          <input id="nq-assunto" value="${dados.assunto}" placeholder="Ex: Flexão" list="lista-assuntos" />
          <datalist id="lista-assuntos">${assuntosExistentes.map((a) => `<option value="${a}">`).join("")}</datalist>
        </div>
      </div>
      <div class="field"><label>Dificuldade (1 a 5)</label><input id="nq-dificuldade" type="number" min="1" max="5" value="${dados.dificuldade}" class="mono" style="max-width:120px;" /></div>
      <div class="field">
        <label>Enunciado (use {NOME} para referenciar qualquer variável OU etapa)</label>
        <textarea id="nq-enunciado" placeholder="Ex: Uma viga retangular tem base {b} cm e altura {h} cm...">${dados.enunciado}</textarea>
      </div>
      <div class="field">
        <label>Imagem / esquema (opcional — diagrama, desenho da viga, circuito, etc.)</label>
        <input type="file" id="nq-imagem" accept="image/*" />
        <div id="nq-imagem-preview" style="margin-top:8px;"></div>
      </div>
      <div class="field">
        <label>Letras gregas e símbolos (î, ĵ, k̂, °, ±...) — clique num campo de texto abaixo e depois no símbolo pra inserir</label>
        <div id="paleta-grega" style="display:flex; flex-wrap:wrap; gap:4px;"></div>
      </div>

      <div class="field">
        <label>Variáveis de entrada (sorteadas aleatoriamente pra cada aluno)</label>
        <div id="nq-vars"></div>
        <button class="btn subtle" id="nq-add-var" type="button">+ Adicionar variável</button>
      </div>

      <div class="field">
        <label>Etapas de cálculo (em ordem — cada uma pode usar as variáveis acima E o resultado de etapas anteriores)</label>
        <div class="hint" style="margin-bottom:4px;">Marque "é resposta" nas etapas que devem aparecer nas alternativas pro aluno responder. Pode marcar mais de uma (ex.: I e σ na mesma questão).</div>
        <div class="hint" style="margin-bottom:8px;">
          Fórmulas aceitam: <code>+ - * / ^</code>, funções <code>sin cos tan sqrt abs ln log</code> (ângulos em graus),
          <code>atan2(y;x)</code> (ângulo já certo em qualquer quadrante), <code>min(a;b)</code>, <code>max(a;b)</code>,
          e condição <code>se(condição;se_verdadeiro;se_falso)</code> — ex.: <code>se(x>0;x;-x)</code>.
          Separe argumentos de função com <b>ponto-e-vírgula</b> (;), não vírgula — a vírgula já é o separador decimal.<br>
          O <code>se()</code> também pode devolver <b>texto</b> entre aspas, ex.: <code>se(Rx>=0;se(Ry>=0;"1º quadrante";"4º quadrante");se(Ry>=0;"2º quadrante";"3º quadrante"))</code>
          — o texto sempre fica coerente com os números daquela alternativa, mesmo nas erradas.
        </div>
        <div id="nq-etapas"></div>
        <button class="btn subtle" id="nq-add-etapa" type="button">+ Adicionar etapa</button>
      </div>

      <div class="field">
        <label>Formato customizado da resposta (opcional — pra vetores, notação especial, etc.)</label>
        <input id="nq-formato-resposta" value="${dados.formatoResposta || ""}" placeholder="Ex: F = ({Fx}î + {Fz}k̂) N" class="mono" />
        <div class="hint">Use {NOME} pra referenciar o valor de uma etapa marcada como "é resposta". Se deixar vazio, mostra do jeito padrão: "Fx = 5 N | Fz = 3 N".</div>
      </div>

      <div style="display:flex; gap:10px; margin-top:6px;">
        <button class="btn subtle" id="nq-testar" type="button">Testar</button>
        <button class="btn" id="nq-salvar" type="button">${editando ? "Salvar alterações" : "Salvar questão"}</button>
      </div>
      <div id="nq-preview" style="margin-top:12px;"></div>
    </div>
  `;

  let campoAtivo = document.getElementById("nq-enunciado");
  container.addEventListener("focusin", (e) => {
    if (e.target.matches("input, textarea")) campoAtivo = e.target;
  });

  function renderImagemPreview() {
    const el = document.getElementById("nq-imagem-preview");
    if (!state.novaQuestaoImagem) { el.innerHTML = ""; return; }
    el.innerHTML = `
      <div style="position:relative; display:inline-block;">
        <img src="${state.novaQuestaoImagem}" style="max-width:220px; max-height:160px; border:1px solid var(--line); display:block;" />
        <button type="button" id="nq-remover-imagem" class="btn danger" style="margin-top:6px; padding:4px 8px; font-size:11px;">Remover imagem</button>
      </div>
    `;
    document.getElementById("nq-remover-imagem").addEventListener("click", () => {
      state.novaQuestaoImagem = null;
      document.getElementById("nq-imagem").value = "";
      renderImagemPreview();
    });
  }
  renderImagemPreview();

  document.getElementById("nq-imagem").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        // reduz pra no máximo 1000px de largura e comprime em JPEG, pra não pesar no banco
        const maxW = 1000;
        const escala = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * escala;
        canvas.height = img.height * escala;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        state.novaQuestaoImagem = canvas.toDataURL("image/jpeg", 0.82);
        renderImagemPreview();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  const LETRAS_GREGAS = ["α","β","γ","δ","ε","ζ","η","θ","ι","κ","λ","μ","ν","ξ","ο","π","ρ","σ","τ","υ","φ","χ","ψ","ω","Δ","Σ","Ω","Φ","Ψ","Θ","Λ","Π","î","ĵ","k̂","°","±","√","∞","²","³"];
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
      el.dispatchEvent(new Event("input", { bubbles: true })); // sem isso, o valor não era salvo (ficava só na tela)
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
      el.addEventListener("focusin", () => { campoAtivo = el; });
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

  function renderEtapaRows() {
    document.getElementById("nq-etapas").innerHTML = state.novaQuestaoEtapas.map((et, i) => `
      <div class="etapa-block">
        <div class="etapa-row1">
          <input placeholder="nome do resultado (ex: I)" value="${et.nome}" data-ei="${i}" data-ecampo="nome" class="mono" style="width:140px;" />
          <textarea placeholder="fórmula (ex: (b*h*h*h)/12 — pode arrastar o canto pra aumentar)" data-ei="${i}" data-ecampo="formula" class="mono" rows="1" style="flex:1; min-height:38px; resize:vertical;">${et.formula}</textarea>
          <button class="btn danger" style="padding:5px 8px;" data-remove-etapa="${i}" type="button">×</button>
        </div>
        <div class="etapa-row2">
          <label class="mono muted" style="font-size:11px;">decimais <input type="number" value="${et.decimais}" data-ei="${i}" data-ecampo="decimais" class="mono" style="width:50px; margin-left:4px;" /></label>
          <label class="mono muted" style="font-size:11px;">unidade <input value="${et.unidade}" data-ei="${i}" data-ecampo="unidade" class="mono" style="width:80px; margin-left:4px;" /></label>
          <label style="font-size:11.5px; display:flex; align-items:center; gap:5px;">
            <input type="checkbox" ${et.saida ? "checked" : ""} data-ei="${i}" data-ecampo="saida" style="width:auto;" /> é resposta (aparece nas alternativas)
          </label>
        </div>
      </div>
    `).join("");
    document.querySelectorAll("[data-ei]").forEach((el) => {
      el.addEventListener("focusin", () => { campoAtivo = el; });
      el.addEventListener("input", () => {
        const i = Number(el.dataset.ei), campo = el.dataset.ecampo;
        if (campo === "saida") state.novaQuestaoEtapas[i][campo] = el.checked;
        else if (campo === "decimais") state.novaQuestaoEtapas[i][campo] = Number(el.value);
        else state.novaQuestaoEtapas[i][campo] = el.value;
      });
    });
    document.querySelectorAll("[data-remove-etapa]").forEach((el) => {
      el.addEventListener("click", () => {
        state.novaQuestaoEtapas.splice(Number(el.dataset.removeEtapa), 1);
        renderEtapaRows();
      });
    });
  }
  renderEtapaRows();

  document.getElementById("nq-add-etapa").addEventListener("click", () => {
    state.novaQuestaoEtapas.push({ nome: "", formula: "", decimais: 2, unidade: "", saida: true });
    renderEtapaRows();
  });

  function coletarQuestao() {
    return {
      disciplina: document.getElementById("nq-disciplina").value.trim(),
      assunto: document.getElementById("nq-assunto").value.trim(),
      dificuldade: Number(document.getElementById("nq-dificuldade").value),
      enunciado: document.getElementById("nq-enunciado").value.trim(),
      variaveis: state.novaQuestaoVars.filter((v) => v.nome),
      etapas: state.novaQuestaoEtapas.filter((et) => et.nome && et.formula),
      imagem: state.novaQuestaoImagem || null,
      formatoResposta: document.getElementById("nq-formato-resposta").value.trim() || null,
    };
  }

  function validar(q) {
    if (!q.disciplina || !q.assunto || !q.enunciado || q.variaveis.length === 0 || q.etapas.length === 0) {
      return "Preencha disciplina, assunto, enunciado, ao menos uma variável e ao menos uma etapa.";
    }
    if (!q.etapas.some((et) => et.saida)) {
      return 'Marque ao menos uma etapa como "é resposta".';
    }
    return null;
  }

  document.getElementById("nq-testar").addEventListener("click", async () => {
    const q = coletarQuestao();
    const erroEl = document.getElementById("erro-questao");
    const previewEl = document.getElementById("nq-preview");
    erroEl.innerHTML = "";
    previewEl.innerHTML = "";
    const erroValidacao = validar(q);
    if (erroValidacao) { erroEl.innerHTML = `<div class="error-box">${erroValidacao}</div>`; return; }
    try {
      const resultado = await api("/questoes/testar", { method: "POST", body: JSON.stringify(q) });
      previewEl.innerHTML = `<div class="ok-box">
        ${q.imagem ? `<img src="${q.imagem}" style="max-width:min(100%, 360px); max-height:260px; width:auto; height:auto; display:block; margin-bottom:10px; border:1px solid var(--line-faint);" />` : ""}
        <div style="margin-bottom:10px;">${resultado.enunciado}</div>
        ${renderAlternativasPreview(resultado.alternativas, q.formatoResposta)}
      </div>`;
    } catch (e) {
      erroEl.innerHTML = `<div class="error-box">${e.message}</div>`;
    }
  });

  document.getElementById("nq-salvar").addEventListener("click", async () => {
    const q = coletarQuestao();
    const erroEl = document.getElementById("erro-questao");
    erroEl.innerHTML = "";
    const erroValidacao = validar(q);
    if (erroValidacao) { erroEl.innerHTML = `<div class="error-box">${erroValidacao}</div>`; return; }
    try {
      if (state.editandoQuestaoId) {
        await api(`/questoes/${state.editandoQuestaoId}`, { method: "PUT", body: JSON.stringify(q) });
      } else {
        await api("/questoes", { method: "POST", body: JSON.stringify(q) });
      }
      state.editandoQuestaoId = null;
      state.editandoQuestaoDados = null;
      state.novaQuestaoVars = [{ nome: "", min: 0, max: 10, decimais: 0 }, { nome: "", min: 0, max: 10, decimais: 0 }];
      state.novaQuestaoEtapas = [{ nome: "", formula: "", decimais: 2, unidade: "", saida: true }];
      state.novaQuestaoImagem = null;
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

  if (!state.alunosSelecionadosInicializado) {
    alunos.forEach((a) => state.alunosSelecionados.add(a.id));
    state.alunosSelecionadosInicializado = true;
  }

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
        <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:10px;">Questões (${state.selecionadas.size} selecionadas de ${questoes.length} no banco)</div>
        ${renderBarraFiltro("montar", questoes, state.filtroMontar)}
        <div id="lista-questoes">
          ${aplicarFiltro(questoes, state.filtroMontar).map((q) => `
            <div class="list-item ${state.selecionadas.has(q.id) ? "checked" : ""}" data-toggle-questao="${q.id}">
              <div class="checkbox ${state.selecionadas.has(q.id) ? "on" : ""}">${state.selecionadas.has(q.id) ? "✓" : ""}</div>
              <div style="flex:1;">
                <div class="mono muted" style="font-size:10.5px;">${q.disciplina}</div>
                <div style="font-weight:600; font-size:13.5px;">${q.assunto}</div>
              </div>
              <div class="dots">${[1,2,3,4,5].map(i => `<div class="dot ${i<=q.dificuldade?'on':''}"></div>`).join("")}</div>
            </div>
          `).join("")}
          ${aplicarFiltro(questoes, state.filtroMontar).length === 0 ? `<div class="card muted" style="text-align:center; padding:24px; font-size:12.5px;">${corners()}Nenhuma questão com esse filtro.</div>` : ""}
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
              <span class="mono muted" style="font-size:11px;">${a.matricula}</span>
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
          <label>Vale quantos pontos?</label>
          <input id="valor" class="mono" type="number" step="0.1" value="10" />
        </div>
        <div class="field">
          <label>Prazo final (opcional — até quando o aluno pode responder)</label>
          <input id="prazo" type="date" />
          <div class="hint">Sem cronômetro — o aluno responde no tempo que quiser, até essa data. Deixe vazio pra não ter prazo.</div>
        </div>
        <div id="erro-publicar"></div>
        <button class="btn" id="btn-publicar" style="width:100%; justify-content:center;" ${state.selecionadas.size === 0 || state.alunosSelecionados.size === 0 ? "disabled" : ""}>
          Publicar e gerar ${state.alunosSelecionados.size} provas individuais
        </button>
      </div>
    </div>
  `;

  document.getElementById("voltar-turma").addEventListener("click", (e) => { e.preventDefault(); setView("turmaDetalhe"); });
  ligarBarraFiltro("montar", state.filtroMontar, () => renderMontar());

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
      const valor = document.getElementById("valor").value;
      const prazoStr = document.getElementById("prazo").value; // "" ou "YYYY-MM-DD"
      const prazoFinal = prazoStr ? new Date(prazoStr + "T23:59:59").toISOString() : null;
      const questaoIds = Array.from(state.selecionadas);
      const alunoIds = Array.from(state.alunosSelecionados);

      const provaMestre = await api("/provas-mestre", {
        method: "POST",
        body: JSON.stringify({ titulo, turmaId: state.turmaAtualId, valor, prazoFinal, questaoIds }),
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
      <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:6px;">Link pra passar pra turma inteira</div>
      <div class="row" style="margin-bottom:16px; gap:8px;">
        <input readonly id="link-turma-tde" value="${window.location.origin}/aluno.html?prova=${r.provaMestreId}" class="mono" style="flex:1; padding:8px 10px; font-size:12.5px; background:var(--surface-raised); border:1px solid var(--line); color:var(--teal);" onclick="this.select()" />
        <button class="btn subtle" id="btn-copiar-link-turma" style="padding:8px 12px; font-size:12px;">Copiar</button>
      </div>
      <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:12px;">Cada aluno entra com a própria matrícula</div>
      ${r.provas.map((p) => `
        <div class="row" style="padding:8px 0; border-top:1px solid var(--line-faint);">
          <span style="font-size:13px;">${p.alunoNome}</span>
          <span class="mono" style="font-size:14px; color:var(--teal); letter-spacing:.05em;">${p.qrToken}</span>
        </div>
      `).join("")}
    </div>
    <button class="btn ghost" style="margin-top:20px;" id="btn-voltar-turma">Voltar à turma</button>
  `;
  document.getElementById("btn-copiar-link-turma").addEventListener("click", (ev) => {
    navigator.clipboard.writeText(document.getElementById("link-turma-tde").value);
    ev.target.textContent = "Copiado!";
    setTimeout(() => { ev.target.textContent = "Copiar"; }, 1500);
  });
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
      <div class="card">${corners()}<div class="stat-label">Média</div><div class="stat-value">${r.media !== null ? formatarBR(r.media) : "—"}</div></div>
      <div class="card">${corners()}<div class="stat-label">Mediana</div><div class="stat-value">${r.mediana !== null ? formatarBR(r.mediana) : "—"}</div></div>
      <div class="card">${corners()}<div class="stat-label">Desvio padrão</div><div class="stat-value">${r.desvioPadrao !== null ? formatarBR(r.desvioPadrao) : "—"}</div></div>
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
      <div class="row" style="margin-bottom:6px;">
        <div class="mono muted" style="font-size:11px; letter-spacing:.06em; text-transform:uppercase;">Notas por aluno (${r.totalFinalizadas}/${r.totalAlunos} finalizaram) — vale ${formatarBR(r.valor)} pts</div>
        <button class="btn subtle" id="btn-exportar-excel" style="font-size:11px; padding:5px 10px;">Exportar Excel</button>
      </div>
      ${r.alunos.map((a, i) => `
        <div class="row" style="padding:10px 0; ${i>0?'border-top:1px solid var(--line-faint);':''}">
          <span style="font-size:13.5px;">${a.alunoNome}</span>
          <span class="mono muted" style="font-size:12px;">${a.status === 'finalizada' ? `${a.acertos}/${a.total} acertos${a.tentativasFeitas>1?` (${a.tentativasFeitas} tentativas)`:''}` : a.status}</span>
          <span style="font-family:var(--f-display); font-weight:700; font-size:15px; width:50px; text-align:right; color:${a.nota===null?'var(--ink-faint)':(a.nota>=r.valor*0.6?'var(--green)':'var(--red)')};">
            ${a.nota !== null ? formatarBR(+a.nota.toFixed(1)) : "—"}
          </span>
        </div>
      `).join("")}
    </div>
  `;

  document.getElementById("select-prova").addEventListener("change", (e) => {
    state.provaAtualId = e.target.value;
    renderResultados();
  });

  document.getElementById("btn-exportar-excel").addEventListener("click", () => {
    const linhas = r.alunos.map((a) => ({
      "Aluno": a.alunoNome,
      "Matrícula": a.matricula,
      "Nota": a.nota !== null ? formatarBR(+a.nota.toFixed(1)) : "",
      "Valor do TDE": formatarBR(r.valor),
      "Acertos": a.status === "finalizada" ? `${a.acertos}/${a.total}` : "",
      "Tentativas": a.tentativasFeitas,
      "Situação": a.nota === null ? "Não finalizou" : (a.nota >= r.valor * 0.6 ? "Aprovado" : "Reprovado"),
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    ws["!cols"] = [{ wch: 32 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Notas");
    const nomeArquivo = `${provaSel.turmaNome} - ${provaSel.titulo}`.replace(/[^\w\s-]/g, "").trim() + ".xlsx";
    XLSX.writeFile(wb, nomeArquivo);
  });
}

render();
