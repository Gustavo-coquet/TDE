const params = new URLSearchParams(window.location.search);
const provaMestreId = params.get("prova");
let token = params.get("token"); // matrícula do aluno
const content = document.getElementById("content");

const state = { prova: null, atual: 0, respostas: {} };

function formatarBR(n) {
  return String(Number(n)).replace(".", ","); // só vírgula decimal, sem separador de milhar
}

// campos de etapas de texto (ex.: "1º quadrante", vindo de um se(...)) devem aparecer do jeito
// que estão, sem tentar formatar como número
function formatarValorCampo(valor, campo) {
  if (typeof valor === "string") return valor;

  const casas = campo && typeof campo.decimais === "number" ? campo.decimais : null;

  // notação científica: 1840 -> 1,84 × 10³ (o expoente vira sobrescrito na exibição)
  if (campo && campo.notacaoCientifica) {
    if (valor === 0) return "0";
    const expoente = Math.floor(Math.log10(Math.abs(valor)));
    const mantissa = valor / Math.pow(10, expoente);
    const mantissaTxt = (casas !== null ? mantissa.toFixed(casas) : String(mantissa)).replace(".", ",");
    return `${mantissaTxt} × 10^{${expoente}}`;
  }

  // casas fixas: todas as alternativas exibem a mesma quantidade, senão a correta se destacaria
  // (ex.: 1,8361 no meio de valores com 2 casas entregaria a resposta)
  if (casas !== null) return valor.toFixed(casas).replace(".", ",");
  return formatarBR(valor);
}

// Aplica a formatação inline (**negrito**, ^{sup}, _{sub}) e escapa HTML por segurança.
// Não mexe em quebras de linha — serve tanto pro enunciado quanto pra nomes/unidades das respostas.
function formatarInline(texto) {
  if (!texto) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\^\{(.+?)\}/g, "<sup>$1</sup>")
    .replace(/_\{(.+?)\}/g, "<sub>$1</sub>");
}

// Remove as marcações sem virar HTML — usado no PDF, que não entende tags.
function limparMarcacoes(texto) {
  if (!texto) return "";
  return String(texto)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\^\{(.+?)\}/g, "$1")
    .replace(/_\{(.+?)\}/g, "$1");
}

// Igual ao formatarInline, mas também converte as quebras de linha em <br> (o navegador as ignora por padrão).
function formatarEnunciado(texto) {
  if (!texto) return "";
  return formatarInline(texto).replace(/\n/g, "<br>");
}

// monta o texto de uma alternativa; se a questão tiver um "formatoResposta" customizado
// (ex.: "F = ({Fx}î + {Fz}k̂) N"), usa ele SÓ pros campos que ele referencia — outros campos
// marcados como "é resposta" que não aparecem no formato continuam mostrados do jeito padrão, do lado.
// comFormatacao=true converte as marcações pra HTML; use false pro PDF, que não entende HTML.
function textoAlternativa(campos, formato, comFormatacao = true) {
  const fmt = (t) => (comFormatacao ? formatarInline(t) : limparMarcacoes(t));
  if (formato) {
    let out = formato;
    const usados = new Set();
    campos.forEach((c) => {
      if (out.includes(`{${c.nome}}`)) {
        out = out.split(`{${c.nome}}`).join(formatarValorCampo(c.valor, c));
        usados.add(c.nome);
      }
    });
    out = fmt(out);
    const restantes = campos.filter((c) => !usados.has(c.nome));
    const textoRestante = restantes.map((c) => `${fmt(c.nome)} = ${fmt(formatarValorCampo(c.valor, c))} ${fmt(c.unidade)}`).join("   |   ");
    return textoRestante ? `${out}   |   ${textoRestante}` : out;
  }
  return campos.map((c) => `${fmt(c.nome)} = ${fmt(formatarValorCampo(c.valor, c))} ${fmt(c.unidade)}`).join("   |   ");
}

// ---------------------------------------------------------------------------
// FIGURA DO BLOCO
// As questões encadeadas de um mesmo grupo são a mesma figura. Em vez de subir o mesmo
// arquivo 14 vezes (e guardar 14 cópias do base64 no banco e no JSON que trafega), só
// UMA questão do grupo carrega a imagem — as outras encontram a dela aqui, na hora de
// exibir. Nada é copiado: o campo "imagem" das outras continua vazio no banco.
function figuraDe(q, todas) {
  if (q.imagem) return q.imagem;
  const g = q.grupoVariaveis || q.grupo || null;
  if (!g || !Array.isArray(todas)) return null;
  const dona = todas.find((o) => (o.grupoVariaveis || o.grupo) === g && o.imagem);
  return dona ? dona.imagem : null;
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
        <span style="font-family:var(--f-display); font-size:22px; font-weight:700; color:var(--teal);">${formatarBR(+dados.melhorNota.toFixed(2))}</span>
      </div>
      <h1 style="font-size:20px;">${dados.tituloProva}</h1>
      <p class="muted" style="font-size:13.5px;">
        Olá, <b style="color:var(--ink);">${dados.alunoNome}</b>! Sua melhor nota até agora é <b style="color:var(--ink);">${formatarBR(+dados.melhorNota.toFixed(2))} de ${formatarBR(dados.valor)}</b>,
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

// ---------------------------------------------------------------------------
// PÁGINAS
// Questões encadeadas (mesmo grupo) viram UMA página: a figura e o bloco de dados
// aparecem uma vez no topo e as perguntas descem em cascata, cada uma com suas
// alternativas. O aluno rola a página e consulta os dados quando quiser. Questão sem
// grupo continua sendo uma página de uma questão só, exatamente como antes.
function paginasDa(questoes) {
  const paginas = [];
  const indice = new Map();
  for (const q of questoes) {
    const g = q.grupo || null;
    if (!g) { paginas.push({ grupo: null, questoes: [q] }); continue; }
    if (!indice.has(g)) { const pg = { grupo: g, questoes: [] }; indice.set(g, pg); paginas.push(pg); }
    indice.get(g).questoes.push(q);
  }
  return paginas;
}

// O "Dados: ..." é igual em todas as questões do bloco. Em vez de repetir 16 vezes,
// achamos o maior trecho FINAL comum a todas e mostramos uma vez só no topo da página.
// Não precisa de marcador nenhum no enunciado: é deduzido do próprio texto.
function sufixoComum(textos) {
  if (textos.length < 2) return "";
  const menor = Math.min(...textos.map((t) => t.length));
  let n = 0;
  while (n < menor && textos.every((t) => t[t.length - 1 - n] === textos[0][textos[0].length - 1 - n])) n++;
  if (n < 40) return "";
  let comum = textos[0].slice(textos[0].length - n);
  // corta no começo de uma linha, pra não partir uma frase no meio
  const quebra = comum.indexOf("\n");
  if (quebra < 0) return "";
  comum = comum.slice(quebra + 1);
  return comum.trim().length >= 30 ? comum : "";
}

function renderProva() {
  const p = state.prova;
  const paginas = paginasDa(p.questoes);
  if (state.atual > paginas.length - 1) state.atual = paginas.length - 1;
  if (state.atual < 0) state.atual = 0;
  const pg = paginas[state.atual];
  const bloco = pg.questoes.length > 1;

  const figura = figuraDe(pg.questoes[0], p.questoes);
  // A figura se repete acima de CADA pergunta do bloco. O mesmo data URL em todas as
  // tags: o navegador decodifica a imagem uma vez e reusa, entao nao pesa nada. O aluno
  // responde a pergunta olhando pra viga, sem ter que voltar o scroll ate o topo.
  const imgFigura = (margem) =>
    figura
      ? `<img src="${figura}" style="max-width:min(100%, 420px); max-height:320px; width:auto; height:auto; display:block; margin:${margem}; border:1px solid var(--line-faint); cursor:zoom-in;" onclick="window.open('${figura}', '_blank')" title="Clique para ampliar" />`
      : "";
  const comum = sufixoComum(pg.questoes.map((q) => q.enunciado));
  const especifico = (q) =>
    comum && q.enunciado.endsWith(comum) ? q.enunciado.slice(0, q.enunciado.length - comum.length).trimEnd() : q.enunciado;

  // a barra de progresso continua por QUESTÃO (é o que o aluno conta), mas cada segmento
  // leva pra PÁGINA onde aquela questão está
  const paginaDe = new Map();
  paginas.forEach((x, i) => x.questoes.forEach((q) => paginaDe.set(q.id, i)));
  const numero = (q) => p.questoes.indexOf(q) + 1;
  const respondidasAqui = pg.questoes.filter((q) => state.respostas[q.id]).length;

  content.innerHTML = `
    <div class="row" style="margin-bottom:10px;">
      <span class="mono muted" style="font-size:12px;">${
        bloco
          ? `BLOCO · QUESTÕES ${numero(pg.questoes[0])} A ${numero(pg.questoes[pg.questoes.length - 1])} DE ${p.questoes.length}`
          : `QUESTÃO ${numero(pg.questoes[0])} / ${p.questoes.length}`
      }</span>
      <span class="mono muted" style="font-size:11px;">Tentativa ${p.tentativa}</span>
    </div>

    <div class="progress-track">
      ${p.questoes
        .map(
          (qq) =>
            `<div class="progress-seg ${
              state.respostas[qq.id] ? "answered" : paginaDe.get(qq.id) === state.atual ? "current" : ""
            }" data-jump="${paginaDe.get(qq.id)}" data-qid="${qq.id}"></div>`
        )
        .join("")}
    </div>
    <div class="muted" style="font-size:11px; margin-bottom:14px;">💾 Suas respostas são salvas automaticamente. Pode pular questões e sair a qualquer momento — depois é só voltar com o mesmo link.${
      bloco ? " Esta página tem várias perguntas sobre a mesma estrutura: role para baixo para ver todas." : ""
    }</div>

    <div class="card">
      <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
      <div class="row" style="align-items:flex-start;">
        <span class="pill">${pg.questoes[0].tema}</span>
        ${bloco ? `<span class="mono muted" style="font-size:11px;" id="contador-pagina">${respondidasAqui} de ${pg.questoes.length} respondidas</span>` : ""}
      </div>
      ${bloco ? "" : imgFigura("14px auto 0")}
      ${comum ? `<div style="font-size:15px; line-height:1.7; margin-top:14px; padding:12px 14px; background:rgba(79,209,197,.06); border-left:3px solid var(--teal);">${formatarEnunciado(comum)}</div>` : ""}
      ${pg.questoes
        .map(
          (q, i) => `
        <div style="margin-top:${i === 0 && !comum && !figura ? "14px" : "20px"}; ${
            bloco ? "border-top:1px solid var(--line-faint); padding-top:16px;" : ""
          }">
          ${bloco ? `<div class="mono" id="rot-${q.id}" style="font-size:11px; color:${state.respostas[q.id] ? "var(--teal)" : "var(--ink-faint)"}; margin-bottom:8px;">QUESTÃO ${numero(q)}${state.respostas[q.id] ? " · respondida" : ""}</div>` : ""}
          ${bloco ? imgFigura("0 auto 14px") : ""}
          <div style="font-size:15.5px; line-height:1.7;">${formatarEnunciado(especifico(q))}</div>
          <div style="margin-top:14px;">
            ${q.alternativas
              .map(
                (a) => `
              <div class="option ${state.respostas[q.id] === a.letra ? "selected" : ""}" data-letra="${a.letra}" data-questao="${q.id}">
                <div class="option-letter">${a.letra}</div>
                <span class="mono" style="font-size:14px;">${textoAlternativa(a.campos, q.formatoResposta)}</span>
              </div>`
              )
              .join("")}
          </div>
        </div>`
        )
        .join("")}
    </div>

    <div class="row" style="margin-top:16px;">
      <button class="btn ghost" id="btn-anterior" ${state.atual === 0 ? "disabled" : ""}>← Anterior</button>
      <div style="display:flex; gap:8px;">
        <button class="btn ghost" id="btn-pausar" style="font-size:12.5px;">Salvar e sair</button>
        ${state.atual < paginas.length - 1
          ? `<button class="btn" id="btn-proxima">Próxima →</button>`
          : `<button class="btn" id="btn-finalizar">✓ Finalizar prova</button>`}
      </div>
    </div>
  `;

  // Marcar uma alternativa NÃO redesenha a página. Numa página de bloco, redesenhar fazia o
  // aluno perder o lugar do scroll (a imagem some e volta, a página encolhe e o navegador
  // corta a rolagem). Aqui a gente mexe só no que mudou.
  content.querySelectorAll("[data-letra]").forEach((el) => {
    el.addEventListener("click", async () => {
      const letra = el.dataset.letra;
      const questaoId = el.dataset.questao;
      state.respostas[questaoId] = letra;

      content.querySelectorAll(`[data-questao="${questaoId}"]`).forEach((o) => o.classList.toggle("selected", o === el));
      const seg = content.querySelector(`[data-qid="${questaoId}"]`);
      if (seg) { seg.classList.add("answered"); seg.classList.remove("current"); }
      const rot = document.getElementById(`rot-${questaoId}`);
      if (rot && !rot.textContent.includes("respondida")) {
        rot.textContent = rot.textContent + " · respondida";
        rot.style.color = "var(--teal)";
      }
      const contador = document.getElementById("contador-pagina");
      if (contador) {
        const n = pg.questoes.filter((x) => state.respostas[x.id]).length;
        contador.textContent = `${n} de ${pg.questoes.length} respondidas`;
      }

      try {
        await api(`/prova/${provaMestreId}/${encodeURIComponent(token)}/responder`, {
          method: "POST",
          body: JSON.stringify({ provaIndividualQuestaoId: questaoId, letra }),
        });
      } catch (e) {
        console.error("Falha ao salvar resposta:", e.message);
      }
    });
  });

  content.querySelectorAll("[data-jump]").forEach((el) => {
    el.addEventListener("click", () => { state.atual = Number(el.dataset.jump); renderProva(); window.scrollTo(0, 0); });
  });

  const btnAnt = document.getElementById("btn-anterior");
  if (btnAnt) btnAnt.addEventListener("click", () => { state.atual = Math.max(0, state.atual - 1); renderProva(); window.scrollTo(0, 0); });
  const btnProx = document.getElementById("btn-proxima");
  if (btnProx) btnProx.addEventListener("click", () => { state.atual++; renderProva(); window.scrollTo(0, 0); });
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
        nota <b style="color:var(--ink);">${formatarBR(+r.notaPontos.toFixed(2))} de ${formatarBR(r.valor)}</b>.
      </p>
      <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
        ${r.detalhe.map((d) => `
          <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:var(--surface); border:1px solid var(--line-faint);">
            <span style="color:${d.correta?'var(--green)':'var(--red)'};">${d.correta ? "✓" : "✗"}</span>
            <span class="muted" style="font-size:12.5px; text-align:left; flex:1;">${d.tema}</span>
          </div>
        `).join("")}
      </div>
      <button class="btn subtle" id="btn-baixar-pdf">⬇ Baixar comprovante em PDF</button>
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

  document.getElementById("btn-baixar-pdf").addEventListener("click", () => gerarPDF(r));

  // gera automaticamente, sem o aluno precisar pedir — serve de comprovante caso precise contestar algo
  try { gerarPDF(r); } catch (e) { console.error("Falha ao gerar PDF automático:", e); }
}

// monta um PDF com o comprovante completo da tentativa: questões, o que o aluno marcou,
// a alternativa correta, e o resultado — pra ele ter um registro e poder contestar se precisar.
function gerarPDF(r) {
  if (!window.jspdf) { console.warn("jsPDF não carregou; pulando geração automática de PDF."); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margem = 15;
  const larguraUtil = 210 - margem * 2;
  let y = margem;

  function quebrarPagina(alturaNecessaria) {
    if (y + alturaNecessaria > 282) { doc.addPage(); y = margem; }
  }
  function escreverParagrafo(texto, tamanho, negrito) {
    doc.setFontSize(tamanho);
    doc.setFont(undefined, negrito ? "bold" : "normal");
    const linhas = doc.splitTextToSize(texto, larguraUtil);
    linhas.forEach((linha) => { quebrarPagina(6); doc.text(linha, margem, y); y += tamanho > 11 ? 6.5 : 5.2; });
  }

  const p = state.prova;
  escreverParagrafo("TDE - La Salle", 15, true);
  escreverParagrafo(`${p.tituloProva} — Tentativa ${r.tentativa}`, 11, true);
  y += 1;
  escreverParagrafo(`Aluno: ${p.alunoNome}     Matrícula: ${token}`, 10, false);
  escreverParagrafo(`Nota: ${formatarBR(+r.notaPontos.toFixed(2))} de ${formatarBR(r.valor)}  (${r.percentual}% de acerto — ${r.acertos} de ${r.total} questões)`, 10, false);
  escreverParagrafo(`Comprovante gerado em: ${new Date().toLocaleString("pt-BR")}`, 9, false);
  y += 4;

  r.detalhe.forEach((d, idx) => {
    quebrarPagina(14);
    doc.setDrawColor(200); doc.line(margem, y, 210 - margem, y); y += 5;
    escreverParagrafo(`Questão ${idx + 1} — ${d.tema}  [${d.correta ? "ACERTOU" : "ERROU"}]`, 11, true);
    // no PDF não dá pra aplicar negrito/sobrescrito no meio da linha, então só limpa as marcações
    // e deixa o texto legível — as quebras de linha o splitTextToSize já respeita
    escreverParagrafo(limparMarcacoes(d.enunciado), 10, false);
    y += 1;
    (d.alternativas || []).forEach((a) => {
      const escolhida = a.letra === d.respostaAlunoLetra;
      const correta = a.letra === d.respostaCorretaLetra;
      const marcador = escolhida ? "[X]" : "[ ]";
      const rotulo = correta ? " (RESPOSTA CORRETA)" : "";
      const texto = `${marcador} ${a.letra}) ${textoAlternativa(a.campos, d.formatoResposta, false)}${rotulo}`;
      escreverParagrafo(texto, 9.5, correta || escolhida);
    });
    y += 4;
  });

  const nomeArquivo = `TDE - ${p.tituloProva} - ${p.alunoNome} - tentativa ${r.tentativa}.pdf`.replace(/[\\/:*?"<>|]/g, "");
  doc.save(nomeArquivo);
}

iniciar();
