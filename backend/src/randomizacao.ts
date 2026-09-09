import { Rng, hashSeed } from "./rng";
import { avaliarExpressao, Valor } from "./questoes/expressao";

export interface VariavelDb {
  nome: string;
  min: number;
  max: number;
  decimais: number;
}

export interface EtapaDb {
  nome: string;       // nome da grandeza calculada nesta etapa (ex.: "I", "sigma", "quadrante")
  formula: string;    // pode usar variaveis de entrada E nomes de etapas anteriores; pode devolver número OU texto
  decimais: number;   // ignorado se a etapa devolver texto
  unidade: string;    // pode ficar vazio pra etapas de texto
  saida: boolean;     // true = esta etapa aparece como uma das respostas mostradas ao aluno
  notacaoCientifica?: boolean; // true = exibe como 1,84 × 10^3 em vez de 1840
}

export interface QuestaoDb {
  id: string;
  enunciado: string;
  variaveis: VariavelDb[];
  etapas: EtapaDb[];
}

export interface CampoAlternativa {
  nome: string;
  unidade: string;
  valor: Valor; // número (caso normal) ou texto (quando a etapa usa se(...;"texto";"texto"))
  decimais?: number;           // quantas casas exibir (todas as alternativas usam a mesma, pra não denunciar a correta)
  notacaoCientifica?: boolean; // exibir em notação científica
}

export interface AlternativaGerada {
  letra: string;
  campos: CampoAlternativa[];
  correta: boolean;
}

export interface QuestaoIndividualGerada {
  questaoId: string;
  ordem: number;
  parametrosGerados: Record<string, Valor>;
  enunciadoFinal: string;
  alternativasFinal: AlternativaGerada[];
  respostaCorretaLetra: string;
}

/**
 * Gera a prova individual de um aluno a partir da Prova-Mestre.
 *
 *  1. Seed determinística = hash(provaMestreId + alunoId) -> reprodutível e auditável.
 *  2. Embaralha a ORDEM das questões (o conjunto de questões nunca muda).
 *  3. Para cada questão, sorteia as variáveis de entrada e resolve as etapas EM ORDEM
 *     (cada etapa pode usar variáveis de entrada e o resultado de etapas anteriores).
 *  4. As etapas marcadas como "saída" viram os campos mostrados nas alternativas.
 *  5. Embaralha as alternativas DEPOIS de saber qual é a correta.
 */
export function gerarProvaIndividual(
  provaMestreId: string,
  alunoId: string,
  questoes: QuestaoDb[]
): { seed: string; questoes: QuestaoIndividualGerada[] } {
  const seedStr = `${provaMestreId}:${alunoId}`;
  const rng = new Rng(hashSeed(seedStr));

  const ordemEmbaralhada = shuffle([...questoes], rng);

  const questoesGeradas: QuestaoIndividualGerada[] = ordemEmbaralhada.map((q, idx) => {
    const valores = resolverEtapas(q.variaveis, q.etapas, rng); // precisão total
    const exibicao = valoresParaExibicao(valores, q.etapas);    // só para mostrar na tela
    const enunciadoFinal = montarEnunciado(q.enunciado, exibicao);
    const alternativas = gerarAlternativasParaQuestao(q.etapas, valores, rng);

    return {
      questaoId: q.id,
      ordem: idx,
      parametrosGerados: valores,
      enunciadoFinal,
      alternativasFinal: alternativas,
      respostaCorretaLetra: alternativas.find((a) => a.correta)!.letra,
    };
  });

  return { seed: seedStr, questoes: questoesGeradas };
}

/**
 * Sorteia as variáveis de entrada e resolve cada etapa em ordem, podendo usar tudo que veio antes.
 *
 * IMPORTANTE — precisão igual à do Excel: o valor guardado aqui é SEMPRE o resultado
 * com precisão total. O campo "decimais" de cada etapa passou a valer só para EXIBIÇÃO
 * (ver valoresParaExibicao), nunca para o cálculo das etapas seguintes.
 *
 * Antes, o valor era arredondado aqui e o valor arredondado alimentava a próxima etapa,
 * o que causava arredondamento em cascata: uma etapa intermediária pequena (ex.: J =
 * 0,00131 m/m com "decimais 2") virava 0,00 e zerava todo o resto da conta.
 *
 * As VARIÁVEIS DE ENTRADA continuam arredondadas na geração (gerarValores), e isso é
 * proposital: elas são o dado que o aluno lê no enunciado, então o número exibido tem
 * que ser exatamente o número usado na conta.
 */
export function resolverEtapas(variaveis: VariavelDb[], etapas: EtapaDb[], rng: Rng): Record<string, Valor> {
  const valores: Record<string, Valor> = gerarValores(variaveis, rng);
  for (const etapa of etapas) {
    valores[etapa.nome] = avaliarExpressao(etapa.formula, valores);
  }
  return valores;
}

/**
 * Devolve uma cópia dos valores arredondada para EXIBIÇÃO, respeitando o "decimais" de
 * cada etapa. Usada no enunciado e nas alternativas — o cálculo em si nunca passa por aqui.
 * Variáveis de entrada não aparecem em "etapas" e são copiadas como estão (já vêm
 * arredondadas da geração).
 */
export function valoresParaExibicao(valores: Record<string, Valor>, etapas: EtapaDb[]): Record<string, Valor> {
  const out: Record<string, Valor> = { ...valores };
  for (const etapa of etapas) {
    const v = out[etapa.nome];
    // notação científica não é arredondada aqui: as casas viram casas da mantissa na hora de exibir
    if (typeof v === "number" && !etapa.notacaoCientifica) out[etapa.nome] = roundTo(v, etapa.decimais);
  }
  return out;
}

export function gerarValores(variaveis: VariavelDb[], rng: Rng): Record<string, number> {
  const valores: Record<string, number> = {};
  for (const v of variaveis) {
    valores[v.nome] = v.decimais > 0 ? roundTo(rng.float(v.min, v.max), v.decimais) : rng.int(v.min, v.max);
  }
  return valores;
}

export function formatarNumeroBR(n: number): string {
  return String(n).replace(".", ","); // só troca o ponto decimal por vírgula, sem separador de milhar
}

export function montarEnunciado(template: string, valores: Record<string, Valor>): string {
  let out = template;
  for (const [k, v] of Object.entries(valores)) {
    out = out.split(`{${k}}`).join(typeof v === "number" ? formatarNumeroBR(v) : v);
  }
  return out;
}

/**
 * Monta as alternativas de uma questão a partir das etapas marcadas como "saída".
 *
 * Etapas NUMÉRICAS (o caso normal) são sorteadas de forma independente pra criar
 * as opções erradas — cada uma ganha valores plausivelmente errados.
 *
 * Etapas de TEXTO (resultado de um se(...;"texto";"texto")) são especiais: em vez de
 * sortear um texto qualquer, o sistema RECALCULA a fórmula pra cada alternativa usando
 * os números daquela alternativa específica. Isso garante que o texto sempre bate com
 * os números mostrados do lado — inclusive nas alternativas erradas (ex.: se "Rx" e "Ry"
 * de uma opção errada são os dois positivos, o texto "1º quadrante" dessa mesma opção
 * é recalculado e fica coerente, em vez de vir de um sorteio independente que poderia
 * mostrar "1º quadrante" ao lado de números que não batem com isso).
 */
export function gerarAlternativasParaQuestao(
  etapas: EtapaDb[],
  valores: Record<string, Valor>,
  rng: Rng
): AlternativaGerada[] {
  const etapasSaida = etapas.filter((e) => e.saida);
  const etapasTexto = etapasSaida.filter((e) => typeof valores[e.nome] === "string");
  const numericas = etapasSaida.filter((e) => typeof valores[e.nome] === "number");

  // Uma etapa de saída que usa OUTRA etapa de saída na sua fórmula é "derivada"
  // (ex.: o módulo |M| depende de Mx, My, Mz). Essas NÃO podem ser sorteadas de forma
  // independente: se fossem, apareceria um módulo que não corresponde às componentes
  // mostradas na mesma alternativa — e a única opção coerente seria a correta,
  // entregando a resposta. Por isso elas são RECALCULADAS a partir dos valores
  // (certos ou errados) de cada alternativa.
  const nomesSaida = new Set(etapasSaida.map((e) => e.nome));
  const ehDerivada = (e: EtapaDb) =>
    Array.from(nomesSaida).some((nome) => nome !== e.nome && referenciaVariavel(e.formula, nome));

  const derivadas = numericas.filter(ehDerivada);
  const independentes = numericas.filter((e) => !ehDerivada(e));

  // o valor CORRETO entra aqui já arredondado para exibição: os distratores também são
  // arredondados com as mesmas casas, então a alternativa certa não pode aparecer com mais
  // casas que as outras (isso entregaria a resposta). O cálculo em si já foi feito com
  // precisão total lá em resolverEtapas.
  const saidasNumericas = independentes.map((e) => ({
    nome: e.nome, unidade: e.unidade,
    valor: e.notacaoCientifica ? (valores[e.nome] as number) : roundTo(valores[e.nome] as number, e.decimais),
    decimais: e.decimais, notacaoCientifica: e.notacaoCientifica,
  }));

  // Caso especial: a resposta é SÓ texto (ex.: "2 < x < 7", "x < 3 ou x > 8"), sem nenhum
  // campo numérico de saída. Aqui não há número visível pra variar, então as 8 alternativas
  // sairiam idênticas. A saída é variar as etapas INTERMEDIÁRIAS (as que não são resposta,
  // mas alimentam o texto) e recalcular a fórmula com esses valores alterados — assim cada
  // alternativa recebe um intervalo diferente, e todos continuam plausíveis.
  if (saidasNumericas.length === 0 && etapasTexto.length > 0) {
    return gerarAlternativasSomenteTexto(etapas, etapasTexto, valores, rng);
  }

  const alternativas = gerarAlternativasMulti(saidasNumericas, rng);

  // recalcula, em cada alternativa, os campos derivados e os de texto usando os valores daquela opção
  const paraRecalcular = [...derivadas, ...etapasTexto];
  if (paraRecalcular.length > 0) {
    for (const alt of alternativas) {
      const contexto: Record<string, Valor> = { ...valores };
      for (const campo of alt.campos) contexto[campo.nome] = campo.valor;

      for (const et of paraRecalcular) {
        let valor: Valor;
        // O campo derivado é SEMPRE recalculado a partir dos valores EXIBIDOS na própria
        // alternativa — inclusive na correta. Isso é essencial: o aluno lê "hf_p = 0,70" e
        // "hf_r = 0,61" na tela e faz H - 0,70 - 0,61. Se a correta usasse a precisão total,
        // o resultado dela poderia fechar em 6,68 enquanto o aluno acha 6,69 — e ele marcaria
        // uma alternativa errada tendo resolvido tudo certo. Recalculando dos valores exibidos,
        // cada linha fica internamente coerente até o último dígito.
        try {
          const bruto = avaliarExpressao(et.formula, contexto);
          valor = typeof bruto === "number" && !et.notacaoCientifica ? roundTo(bruto, et.decimais) : bruto;
        } catch {
          const bruto = valores[et.nome]; // fallback: não quebra a prova
          valor = typeof bruto === "number" && !et.notacaoCientifica ? roundTo(bruto, et.decimais) : bruto;
        }
        contexto[et.nome] = valor;
        alt.campos.push({
          nome: et.nome, unidade: et.unidade, valor,
          decimais: et.decimais, notacaoCientifica: et.notacaoCientifica,
        });
      }
    }
  }

  return alternativas;
}

/** true se a fórmula usa a variável informada (respeitando limites de palavra, pra "M" não casar dentro de "Mx") */
function referenciaVariavel(formula: string, nome: string): boolean {
  const escapado = nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-zΑ-Ωα-ω0-9_])${escapado}([^A-Za-zΑ-Ωα-ω0-9_]|$)`).test(formula);
}

/**
 * Gera alternativas quando TODAS as saídas são texto (intervalos de inequação, classificações...).
 * Estratégia: perturbar os valores numéricos que o texto usa (variáveis de entrada e etapas
 * intermediárias) e recalcular a fórmula, produzindo textos diferentes mas com a mesma "cara".
 */
function gerarAlternativasSomenteTexto(
  todasEtapas: EtapaDb[],
  etapasTexto: EtapaDb[],
  valores: Record<string, Valor>,
  rng: Rng
): AlternativaGerada[] {
  const TOTAL = 8;

  // números que o texto pode usar: variáveis de entrada + etapas intermediárias numéricas
  const nomesNumericos = Object.keys(valores).filter((k) => typeof valores[k] === "number");

  const textosCorretos = etapasTexto.map((et) => String(valores[et.nome]));
  const vistos = new Set<string>([textosCorretos.join("§")]);
  const conjuntos: { textos: string[]; correta: boolean }[] = [
    { textos: textosCorretos, correta: true },
  ];

  let tentativas = 0;
  while (conjuntos.length < TOTAL && tentativas < 400) {
    tentativas++;

    // perturba os números e recalcula as etapas em cadeia, pra manter tudo coerente
    const contexto: Record<string, Valor> = { ...valores };
    for (const nome of nomesNumericos) {
      const original = valores[nome] as number;
      const escala = Math.abs(original) || 1;
      const delta = escala * (rng.int(10, 60) / 100) * (rng.int(0, 1) ? 1 : -1);
      contexto[nome] = Math.round(original + delta);
    }
    // recalcula as etapas na ordem, pra que "menor"/"maior" etc. acompanhem os novos números
    for (const et of todasEtapas) {
      try {
        const v = avaliarExpressao(et.formula, contexto);
        contexto[et.nome] = typeof v === "number" ? roundTo(v, et.decimais) : v;
      } catch {
        /* etapa que não resolve com esses valores: ignora e segue */
      }
    }

    const textos = etapasTexto.map((et) => String(contexto[et.nome] ?? valores[et.nome]));
    const chave = textos.join("§");
    if (!vistos.has(chave)) {
      vistos.add(chave);
      conjuntos.push({ textos, correta: false });
    }
  }

  const arr = conjuntos.map((c) => ({
    campos: etapasTexto.map((et, i) => ({ nome: et.nome, unidade: et.unidade, valor: c.textos[i] as Valor })),
    correta: c.correta,
  }));

  const embaralhado = shuffle(arr, rng);
  return embaralhado.map((a, i) => ({ ...a, letra: String.fromCharCode(65 + i) }));
}

/**
 * Gera alternativas quando a "resposta" é composta por mais de um campo NUMÉRICO
 * (ex.: F=30 N e P=60 Pa no mesmo item). Cada campo recebe seu próprio conjunto
 * de valores plausivelmente errados; as alternativas erradas misturam campos
 * certos e errados, então um aluno que acerta só uma etapa não acerta a questão.
 */
export function gerarAlternativasMulti(
  saidas: { nome: string; unidade: string; valor: number; decimais?: number; notacaoCientifica?: boolean }[],
  rng: Rng
): AlternativaGerada[] {
  const TOTAL_ALTERNATIVAS = 8; // A até H — só uma correta, dificulta o chute
  const fatores = [0.4, 0.5, 0.6, 0.75, 1.25, 1.5, 1.75, 2, 2.5];

  // cada distrator é arredondado com a MESMA quantidade de casas da etapa correspondente.
  // sem isso, a alternativa correta apareceria com mais casas que as outras (ex.: 1,8361 no meio
  // de valores com 2 casas) e entregaria a resposta de graça.
  const casas = saidas.map((s) => (typeof s.decimais === "number" ? s.decimais : 2));

  const pools = saidas.map((s, idx) => {
    const valores = new Set<number>();
    let tentativas = 0;
    // se o valor certo é negativo (ângulo, componente de vetor...), aceita distratores negativos também;
    // se o valor certo é positivo (densidade, força, massa...), não faz sentido gerar um errado negativo
    const podeSerNegativo = s.valor < 0;
    // o "empurrãozinho" extra é proporcional à grandeza do valor: somar 1..5 fixo faria um
    // resultado como 0,000032 virar distratores absurdos (3, 4...), fora de escala.
    const escala = Math.abs(s.valor) || 1;
    while (valores.size < TOTAL_ALTERNATIVAS - 1 && tentativas < 150) {
      tentativas++;
      const fator = fatores[rng.int(0, fatores.length - 1)];
      const sinal = rng.int(0, 1) ? 1 : -1;
      const bruto = s.valor * fator + sinal * escala * (rng.int(1, 20) / 100); // ±1% a ±20% do valor
      // em notação científica não arredondamos aqui — o arredondamento vira mantissa na exibição
      const errado = s.notacaoCientifica ? bruto : roundTo(bruto, casas[idx]);
      if (errado !== s.valor && !valores.has(errado) && (podeSerNegativo || errado > 0)) valores.add(errado);
    }
    return Array.from(valores);
  });

  const tuplaCorreta = saidas.map((s) => s.valor);
  const tuplas: number[][] = [tuplaCorreta];

  let tentativas = 0;
  while (tuplas.length < TOTAL_ALTERNATIVAS && tentativas < 600) {
    tentativas++;
    const tupla = saidas.map((s, i) => {
      const pool = pools[i];
      if (pool.length === 0) return s.valor;
      const usarDistrator = rng.int(0, 1) === 1;
      return usarDistrator ? pool[rng.int(0, pool.length - 1)] : s.valor;
    });
    const igualCorreta = tupla.every((v, i) => v === tuplaCorreta[i]);
    const jaExiste = tuplas.some((t) => t.every((v, i) => v === tupla[i]));
    if (!igualCorreta && !jaExiste) tuplas.push(tupla);
  }
  // fallback caso não tenha conseguido gerar tuplas suficientes distintas (campos com pouca variação possível)
  while (tuplas.length < TOTAL_ALTERNATIVAS) {
    const tupla = saidas.map((s, i) => {
      const pool = pools[i];
      const base = pool.length ? pool[rng.int(0, pool.length - 1)] : s.valor;
      const escala = Math.abs(s.valor) || 1;
      const bruto = base + escala * (rng.int(1, 25) / 100); // ajuste proporcional, não soma fixa
      return s.notacaoCientifica ? bruto : roundTo(bruto, casas[i]);
    });
    tuplas.push(tupla);
  }

  const arr = tuplas.map((tupla) => ({
    campos: saidas.map((s, i) => ({ nome: s.nome, unidade: s.unidade, valor: tupla[i] as Valor, decimais: casas[i], notacaoCientifica: s.notacaoCientifica })),
    correta: tupla.every((v, i) => v === tuplaCorreta[i]),
  }));

  const embaralhado = shuffle(arr, rng);
  return embaralhado.map((a, i) => ({ ...a, letra: String.fromCharCode(65 + i) }));
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function roundTo(n: number, d: number) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
