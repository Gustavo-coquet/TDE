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
// Protege zonas de LaTeX ($$...$$ e $...$) pra que o KaTeX possa renderizar sem interferência:
// o _{...} e ^{...} do LaTeX NÃO podem virar <sub>/<sup> antes do KaTeX, senão ele vê HTML
// no meio e desiste. A gente guarda cada zona num placeholder, aplica os replaces no resto,
// e depois devolve as zonas intactas (só com os caracteres HTML perigosos escapados).
function formatarInline(texto) {
  if (!texto) return "";
  const zonas = [];
  const token = (i) => `\u0001MATH${i}\u0001`;
  // guarda $$...$$ primeiro (não gulose, não cruza linha vazia), depois $...$ (não gulose, mesma linha)
  let s = String(texto)
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => { zonas.push({ display: true, body: m }); return token(zonas.length - 1); })
    .replace(/\$([^\$\n]+?)\$/g,     (_, m) => { zonas.push({ display: false, body: m }); return token(zonas.length - 1); });
  s = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\^\{(.+?)\}/g, "<sup>$1</sup>")
    .replace(/_\{(.+?)\}/g, "<sub>$1</sub>");
  // devolve as zonas de math como texto bruto, só escapando & < > " (o KaTeX precisa de \ { } $ intactos)
  const escMath = (m) => m.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return s.replace(/\u0001MATH(\d+)\u0001/g, (_, i) => {
    const z = zonas[+i];
    return z.display ? `$$${escMath(z.body)}$$` : `$${escMath(z.body)}$`;
  });
}

// Converte LaTeX puro para texto Unicode legível — usado no PDF, que não renderiza equações.
// Expande \dfrac, \sqrt, \frac, operadores (\to, \cdot, \pm, \leq, ...), letras gregas e
// \lim_{...}, deixando algo como "lim(x→0) (√(x+36)-6)/(x)" em vez do LaTeX cru.
function latexParaTexto(s) {
  if (!s) return "";
  let t = String(s);
  // \lim_{x \to 0} → "lim(x -> 0)"  (resolve ANTES de \to)
  t = t.replace(/\\lim\s*_\{([^{}]*)\}/g, (_, sub) => "lim(" + sub.trim() + ")");
  t = t.replace(/\\lim\b/g, "lim");
  // \displaystyle / \textstyle / \scriptstyle
  t = t.replace(/\\(?:displaystyle|textstyle|scriptstyle)\s*/g, "");
  // \sqrt[n]{A} → "raiz_n(A)";  \sqrt{A} → "sqrt(A)";  \frac/\dfrac/\tfrac/\cfrac {A}{B} → "(A)/(B)"
  // Precisa alternar: o conteúdo pode ser aninhado (\dfrac{\sqrt{x}-6}{x}).
  // Começa pelas folhas (grupos sem { dentro) e vai subindo até a raiz.
  for (let i = 0; i < 20; i++) {
    const antes = t;
    t = t.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, "raiz_$1($2)");
    t = t.replace(/\\sqrt\s*\{([^{}]*)\}/g, "sqrt($1)");
    t = t.replace(/\\(?:d|t|c)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)");
    if (t === antes) break;
  }
  // Primeiro: espaços LaTeX "\,"  "\;"  "\:"  "\!"  "\ "  "\quad" "\qquad"
  // (não têm letra depois do \, então o lookahead do bloco seguinte não serve)
  t = t.replace(/\\[,;:]/g, " ")
       .replace(/\\!/g, "")
       .replace(/\\(?:quad|qquad)\b/g, "  ")
       .replace(/\\ /g, " ");
  // Operadores e símbolos — usando ASCII/Latin-1 (jsPDF Helvetica default)
  const mapa = {
    "\\\\to": "->",         "\\\\rightarrow": "->", "\\\\leftarrow": "<-",
    "\\\\cdot": "·",   "\\\\times": "×",  "\\\\div": "÷",
    "\\\\pm": "±",     "\\\\mp": "-/+",
    "\\\\leq": "<=",        "\\\\le": "<=",         "\\\\geq": ">=", "\\\\ge": ">=",
    "\\\\neq": "!=",        "\\\\ne": "!=",         "\\\\approx": "~=", "\\\\equiv": "===",
    "\\\\infty": "inf",     "\\\\partial": "d",     "\\\\nabla": "grad",
    "\\\\int": "integ",     "\\\\sum": "soma",      "\\\\prod": "prod",
    "\\\\sin": "sen",       "\\\\cos": "cos",       "\\\\tan": "tg",
    "\\\\arcsin": "arcsen", "\\\\arccos": "arccos", "\\\\arctan": "arctg",
    "\\\\log": "log",       "\\\\ln": "ln",         "\\\\exp": "exp",
    "\\\\ldots": "...",     "\\\\cdots": "...",     "\\\\dots": "...",
    "\\\\left": "",         "\\\\right": "",        "\\\\big": "", "\\\\Big": "", "\\\\bigg": "", "\\\\Bigg": "",
    "\\\\text": "",         "\\\\mathrm": "",       "\\\\mathbf": "", "\\\\mathit": "",
    // letras gregas — por nome (Helvetica não tem os glifos)
    "\\\\alpha": "alpha",   "\\\\beta": "beta",     "\\\\gamma": "gamma", "\\\\delta": "delta",
    "\\\\epsilon": "eps",   "\\\\varepsilon": "eps","\\\\zeta": "zeta",   "\\\\eta": "eta",
    "\\\\theta": "theta",   "\\\\iota": "iota",     "\\\\kappa": "kappa", "\\\\lambda": "lambda",
    "\\\\mu": "μ",     "\\\\nu": "nu",         "\\\\xi": "xi",       "\\\\omicron": "o",
    "\\\\pi": "pi",         "\\\\rho": "rho",       "\\\\sigma": "sigma", "\\\\tau": "tau",
    "\\\\upsilon": "upsilon","\\\\phi": "phi",      "\\\\chi": "chi",     "\\\\psi": "psi",
    "\\\\omega": "omega",
    "\\\\Gamma": "Gamma",   "\\\\Delta": "Delta",   "\\\\Theta": "Theta", "\\\\Lambda": "Lambda",
    "\\\\Xi": "Xi",         "\\\\Pi": "Pi",         "\\\\Sigma": "Sigma", "\\\\Phi": "Phi",
    "\\\\Psi": "Psi",       "\\\\Omega": "Omega",
  };
  for (const [k, v] of Object.entries(mapa)) t = t.replace(new RegExp(k + "(?![a-zA-Z])", "g"), v);
  // Subscritos/sobrescritos: _{abc} / ^{abc} / _a / ^a  — ^2 pra 'x^2'; _{s,v} pra T_s
  t = t.replace(/\^\{([^{}]*)\}/g, "^($1)").replace(/_\{([^{}]*)\}/g, "_($1)");
  t = t.replace(/\^([0-9a-zA-Z])/g, "^$1").replace(/_([0-9a-zA-Z])/g, "_$1");
  // Remove chaves que sobraram (grupos sem comando)
  t = t.replace(/\{([^{}]*)\}/g, "$1");
  // Normaliza espaços
  t = t.replace(/ {2,}/g, " ").replace(/\s+([,.;:)])/g, "$1");
  return t;
}

// Remove as marcações sem virar HTML — usado no PDF, que não entende tags.
function limparMarcacoes(texto) {
  if (!texto) return "";
  let t = String(texto);
  // Desembala $$...$$ e $...$ e aplica a conversão LaTeX → Unicode ao conteúdo deles
  t = t.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => latexParaTexto(m));
  t = t.replace(/\$([^\$\n]+?)\$/g, (_, m) => latexParaTexto(m));
  // **negrito** vira texto cru
  t = t.replace(/\*\*(.+?)\*\*/g, "$1");
  // Converte LaTeX também em pedaços fora dos $...$ (ex.: textos com \to soltos)
  t = latexParaTexto(t);
  return t;
}

// Igual ao formatarInline, mas também converte as quebras de linha em <br> (o navegador as ignora por padrão).
function formatarEnunciado(texto) {
  if (!texto) return "";
  return formatarInline(texto).replace(/\n/g, "<br>");
}

// Renderiza equações LaTeX entre $...$ (inline) e $$...$$ (display) usando KaTeX.
// Chamar depois de qualquer content.innerHTML = ... que mostre enunciado/alternativas.
// Se o KaTeX ainda não carregou (CDN lenta na 1ª visita), tenta de novo em 100ms, até 10x.
function renderMath(el, tentativa = 0) {
  const alvo = el || content;
  if (window.renderMathInElement) {
    try {
      window.renderMathInElement(alvo, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$",  right: "$",  display: false },
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true },
        ],
        throwOnError: false,
        strict: "ignore",
      });
    } catch (e) { console.warn("KaTeX falhou:", e); }
  } else if (tentativa < 10) {
    setTimeout(() => renderMath(alvo, tentativa + 1), 100);
  }
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
    // modo professor: tira o código mestre da barra de endereço (não fica no histórico nem aparece se projetar a tela)
    if (dados.modoProfessor) history.replaceState(null, "", `?prova=${provaMestreId}`);
    if (dados.estado === "em_andamento") {
      state.prova = dados;
      state.respostas = {};
      state.respostasSalvas = {};
      state.salvandoPendente = 0;
      dados.questoes.forEach((q) => {
        if (q.respostaAlunoLetra) {
          state.respostas[q.id] = q.respostaAlunoLetra;
          // Veio do banco → já está salva
          state.respostasSalvas[q.id] = q.respostaAlunoLetra;
        }
      });
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
        state.respostasSalvas = {};
        state.salvandoPendente = 0;
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
      ${p.modoProfessor ? `<div class="pill amber" style="font-size:12px; padding:6px 12px;">MODO PROFESSOR — prova de teste: nada é salvo e não aparece nos resultados</div>` : ""}
      <p class="muted" style="font-size:14px; line-height:1.7;">${frase} Boa sorte! 🍀</p>
      <div class="card" style="width:100%; text-align:left;">
        <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
        <div style="font-weight:600; font-size:15px; margin-bottom:4px;">${p.tituloProva}</div>
        <div class="muted" style="font-size:12.5px; margin-bottom:10px;">Tentativa ${p.tentativa} de no máximo 2</div>
        <div class="row" style="font-size:13px; padding:6px 0; border-top:1px solid var(--line-faint);"><span class="muted">Este TDE tem</span><span>${(() => {
          const nPag = paginasDa(p.questoes).length;
          const temBloco = nPag !== p.questoes.length;
          return temBloco
            ? `${nPag} questões <span class="muted" style="font-size:11px;">(algumas com várias partes)</span>`
            : `${nPag} questões`;
        })()}</span></div>
        <div class="row" style="font-size:13px; padding:6px 0; border-top:1px solid var(--line-faint);"><span class="muted">e vale</span><span style="color:var(--teal); font-weight:600;">${formatarBR(p.valor)} pontos</span></div>
        <div class="row" style="font-size:13px; padding:6px 0; border-top:1px solid var(--line-faint);"><span class="muted">Matrícula</span><span class="mono" style="color:var(--teal);">${p.modoProfessor ? "modo professor" : token}</span></div>
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
          ? `QUESTÃO ${state.atual + 1} / ${paginas.length} · ${pg.questoes.length} PARTES`
          : `QUESTÃO ${state.atual + 1} / ${paginas.length}`
      }</span>
      <span class="mono muted" style="font-size:11px;">Tentativa ${p.tentativa}</span>
    </div>

    <div class="progress-track">
      ${paginas
        .map((pag, idx) => {
          // "answered" (verde) só quando o servidor CONFIRMOU todas as respostas da página.
          // Marcação local sem confirmação fica como "partial" (cinza-amarelado), pra o
          // aluno ver que faltou algo. Assim a barra verde é promessa de que tá salvo.
          const salvas = state.respostasSalvas || {};
          const marcadas = state.respostas || {};
          const todasSalvas = pag.questoes.every((q) => salvas[q.id]);
          const algumaSalvaOuMarcada = pag.questoes.some((q) => salvas[q.id] || marcadas[q.id]);
          const todasMarcadas = pag.questoes.every((q) => marcadas[q.id]);
          const classe = todasSalvas
            ? "answered"
            : idx === state.atual
            ? "current"
            : todasMarcadas
            ? "partial pendente-salvar"
            : algumaSalvaOuMarcada
            ? "partial"
            : "";
          const titulo = `Questão ${idx + 1}${pag.questoes.length > 1 ? ` (${pag.questoes.length} partes)` : ""} — clique para ir`;
          return `<div class="progress-seg ${classe}" data-jump="${idx}" data-seg-idx="${idx}" style="cursor:pointer;" title="${titulo}"></div>`;
        })
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

  // Renderiza equações LaTeX ($...$ / $$...$$) com KaTeX depois que o HTML do enunciado
  // e das alternativas foi inserido.
  renderMath(content);

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

      // Feedback visual: "salvando..." → "✓ salva" ou aviso de erro, e retry automático.
      // Isso evita o caso "cliquei, sumi e o servidor nunca recebeu" que gerava reclamação.
      const marcarStatus = (texto, cor) => {
        if (!rot) return;
        const base = `QUESTÃO ${rot.textContent.match(/QUESTÃO\s+(\S+)/)?.[1] || ""}`.trim();
        rot.textContent = `${base} · ${texto}`;
        rot.style.color = cor;
      };
      marcarStatus("salvando…", "var(--ink-faint)");
      state.salvandoPendente = (state.salvandoPendente || 0) + 1;

      const salvar = async (tent) => {
        try {
          await api(`/prova/${provaMestreId}/${encodeURIComponent(token)}/responder`, {
            method: "POST",
            body: JSON.stringify({ provaIndividualQuestaoId: questaoId, letra }),
          });
          state.respostasSalvas = state.respostasSalvas || {};
          state.respostasSalvas[questaoId] = letra;
          marcarStatus("respondida ✓", "var(--teal)");
          atualizarBarraProgresso();
        } catch (e) {
          if (tent < 2) {
            await new Promise((r) => setTimeout(r, 600 * (tent + 1)));
            return salvar(tent + 1);
          }
          console.error("Falha ao salvar resposta:", e.message);
          marcarStatus("NÃO SALVA — clique de novo", "var(--red)");
          mostrarAvisoSalvamento();
          atualizarBarraProgresso();
        } finally {
          state.salvandoPendente = Math.max(0, (state.salvandoPendente || 1) - 1);
        }
      };
      await salvar(0);
    });
  });

  // Reaplica a classe de cada segmento da barra sem redesenhar a página inteira
  // (pra não perder o scroll do aluno).
  function atualizarBarraProgresso() {
    const salvas = state.respostasSalvas || {};
    const marcadas = state.respostas || {};
    document.querySelectorAll(".progress-seg[data-seg-idx]").forEach((seg) => {
      const i = Number(seg.dataset.segIdx);
      const pag = paginas[i];
      if (!pag) return;
      const todasSalvas = pag.questoes.every((q) => salvas[q.id]);
      const todasMarcadas = pag.questoes.every((q) => marcadas[q.id]);
      const algumaMarc = pag.questoes.some((q) => salvas[q.id] || marcadas[q.id]);
      seg.classList.remove("answered", "current", "partial", "pendente-salvar");
      if (todasSalvas) seg.classList.add("answered");
      else if (i === state.atual) seg.classList.add("current");
      else if (todasMarcadas) { seg.classList.add("partial"); seg.classList.add("pendente-salvar"); }
      else if (algumaMarc) seg.classList.add("partial");
    });
  }

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

function mostrarAvisoSalvamento() {
  let t = document.getElementById("toast-salvar");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast-salvar";
    t.style.cssText = "position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#3a1414; color:#ffd7d7; border:1px solid #ff9c9c; padding:10px 16px; border-radius:8px; font-size:13px; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,.4);";
    document.body.appendChild(t);
  }
  t.textContent = "⚠ Alguma resposta não foi salva no servidor. Clique de novo na alternativa antes de finalizar.";
  clearTimeout(t._tid);
  t._tid = setTimeout(() => { t.remove(); }, 6000);
}

async function finalizar() {
  const p = state.prova;
  if (!p || !p.questoes) return;

  // 1) Bloqueio: toda questão precisa ter uma letra marcada.
  const numeroDe = (q) => p.questoes.indexOf(q) + 1;
  const semResposta = p.questoes.filter((q) => !state.respostas[q.id]);
  if (semResposta.length > 0) {
    const nums = semResposta.map((q) => numeroDe(q)).join(", ");
    alert(
      `Você ainda não respondeu ${semResposta.length} ${semResposta.length === 1 ? "questão" : "questões"}: ${nums}.\n\n` +
      `Volte e marque uma alternativa em cada uma antes de finalizar.`
    );
    // Leva o aluno pra primeira questão sem resposta
    const alvo = semResposta[0];
    const paginas = paginasDa(p.questoes);
    const pIdx = paginas.findIndex((pg) => pg.questoes.some((q) => q.id === alvo.id));
    if (pIdx >= 0) { state.atual = pIdx; renderProva(); window.scrollTo(0, 0); }
    return;
  }

  // 2) Bloqueio: tem resposta pendente de salvar no servidor (clique recente, rede lenta).
  if (state.salvandoPendente && state.salvandoPendente > 0) {
    alert("Ainda estamos salvando a última resposta. Espere 2 segundos e clique em Finalizar de novo.");
    return;
  }

  // 3) BLOQUEIO: qualquer resposta marcada localmente que não foi confirmada como salva no
  // servidor é considerada perdida. Tenta re-salvar automaticamente; se ainda falhar, NÃO
  // deixa finalizar — resposta não salva vira "errou" no PDF, e isso não pode acontecer.
  state.respostasSalvas = state.respostasSalvas || {};
  const naoConfirmadas = p.questoes.filter((q) => {
    const marcada = state.respostas[q.id];
    const salva = state.respostasSalvas[q.id];
    return marcada && salva !== marcada;
  });
  if (naoConfirmadas.length > 0) {
    const btnFim = document.getElementById("btn-finalizar");
    if (btnFim) { btnFim.disabled = true; btnFim.textContent = "Salvando respostas pendentes…"; }
    // Tenta salvar cada uma, em sequência, com retry
    const aindaFalham = [];
    for (const q of naoConfirmadas) {
      const letra = state.respostas[q.id];
      let sucesso = false;
      for (let tent = 0; tent < 3 && !sucesso; tent++) {
        try {
          await api(`/prova/${provaMestreId}/${encodeURIComponent(token)}/responder`, {
            method: "POST",
            body: JSON.stringify({ provaIndividualQuestaoId: q.id, letra }),
          });
          state.respostasSalvas[q.id] = letra;
          sucesso = true;
        } catch (e) {
          await new Promise((r) => setTimeout(r, 500 * (tent + 1)));
        }
      }
      if (!sucesso) aindaFalham.push(q);
    }
    if (btnFim) { btnFim.disabled = false; btnFim.textContent = "✓ Finalizar prova"; }
    // Atualiza visualmente os segmentos que acabaram de confirmar salvamento
    document.querySelectorAll(".progress-seg[data-seg-idx]").forEach((seg) => {
      const i = Number(seg.dataset.segIdx);
      const paginas = paginasDa(p.questoes);
      const pag = paginas[i];
      if (!pag) return;
      if (pag.questoes.every((q) => state.respostasSalvas[q.id])) {
        seg.classList.remove("current", "partial", "pendente-salvar");
        seg.classList.add("answered");
      }
    });

    if (aindaFalham.length > 0) {
      const nums = aindaFalham.map((q) => numeroDe(q)).join(", ");
      alert(
        `Não conseguimos salvar as respostas das questões ${nums} no servidor.\n\n` +
        `Isso quase sempre é problema de internet. Verifique sua conexão, atualize a página (F5) e tente de novo.\n\n` +
        `Não vamos finalizar agora — se a gente finalizasse, essas questões contariam como erradas.`
      );
      return;
    }
  }

  // 4) Confirmação final.
  const ok = confirm("Tem certeza que quer finalizar? Depois de finalizar você não pode mais alterar as respostas.");
  if (!ok) return;

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
        state.respostasSalvas = {};
        state.salvandoPendente = 0;
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
  // (no modo professor não baixa sozinho; o botão continua lá se quiser)
  if (!r.modoProfessor) try { gerarPDF(r); } catch (e) { console.error("Falha ao gerar PDF automático:", e); }
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
  escreverParagrafo(`Aluno: ${p.alunoNome}     Matrícula: ${p.modoProfessor ? "modo professor (teste)" : token}`, 10, false);
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

// Observa o #content e roda o KaTeX sempre que o HTML muda — redundante com o renderMath()
// no final de renderProva() mas garante que as outras telas (resultado, pausa, erro) também
// renderizem equações se elas tiverem $...$ no enunciado.
(function ligarKaTeXAutomatico() {
  if (!content) return;
  let pendente = false;
  const config = { childList: true, subtree: true, characterData: true };
  const observer = new MutationObserver(() => {
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(() => {
      pendente = false;
      observer.disconnect();
      try { renderMath(content); } finally { observer.observe(content, config); }
    });
  });
  observer.observe(content, config);
})();

iniciar();
