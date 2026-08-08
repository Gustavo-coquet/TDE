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
    const valores = resolverEtapas(q.variaveis, q.etapas, rng);
    const enunciadoFinal = montarEnunciado(q.enunciado, valores);
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

/** Sorteia as variáveis de entrada e resolve cada etapa em ordem, podendo usar tudo que veio antes. */
export function resolverEtapas(variaveis: VariavelDb[], etapas: EtapaDb[], rng: Rng): Record<string, Valor> {
  const valores: Record<string, Valor> = gerarValores(variaveis, rng);
  for (const etapa of etapas) {
    const bruto = avaliarExpressao(etapa.formula, valores);
    valores[etapa.nome] = typeof bruto === "number" ? roundTo(bruto, etapa.decimais) : bruto;
  }
  return valores;
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
  const saidasNumericas = etapasSaida
    .filter((e) => typeof valores[e.nome] === "number")
    .map((e) => ({ nome: e.nome, unidade: e.unidade, valor: valores[e.nome] as number }));
  const etapasTexto = etapasSaida.filter((e) => typeof valores[e.nome] === "string");

  const alternativas = gerarAlternativasMulti(saidasNumericas, rng);

  if (etapasTexto.length > 0) {
    for (const alt of alternativas) {
      // recria o "contexto" dessa alternativa: os mesmos valores de sempre, mas com os
      // campos numéricos trocados pelos valores (certos ou errados) DESSA alternativa
      const contexto: Record<string, Valor> = { ...valores };
      for (const campo of alt.campos) contexto[campo.nome] = campo.valor;

      for (const et of etapasTexto) {
        let texto: string;
        try {
          const recalculado = avaliarExpressao(et.formula, contexto);
          texto = String(recalculado);
        } catch {
          texto = String(valores[et.nome]); // fallback: não deveria acontecer, mas evita quebrar a prova
        }
        alt.campos.push({ nome: et.nome, unidade: et.unidade, valor: texto });
      }
    }
  }

  return alternativas;
}

/**
 * Gera alternativas quando a "resposta" é composta por mais de um campo NUMÉRICO
 * (ex.: F=30 N e P=60 Pa no mesmo item). Cada campo recebe seu próprio conjunto
 * de valores plausivelmente errados; as alternativas erradas misturam campos
 * certos e errados, então um aluno que acerta só uma etapa não acerta a questão.
 */
export function gerarAlternativasMulti(
  saidas: { nome: string; unidade: string; valor: number }[],
  rng: Rng
): AlternativaGerada[] {
  const TOTAL_ALTERNATIVAS = 8; // A até H — só uma correta, dificulta o chute
  const fatores = [0.4, 0.5, 0.6, 0.75, 1.25, 1.5, 1.75, 2, 2.5];

  const pools = saidas.map((s) => {
    const valores = new Set<number>();
    let tentativas = 0;
    while (valores.size < TOTAL_ALTERNATIVAS - 1 && tentativas < 150) {
      tentativas++;
      const fator = fatores[rng.int(0, fatores.length - 1)];
      const sinal = rng.int(0, 1) ? 1 : -1;
      const errado = round2(s.valor * fator + sinal * rng.int(1, 5));
      if (errado !== s.valor && !valores.has(errado)) valores.add(errado); // aceita negativo também (Ry, ângulos, etc. podem ser negativos)
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
      return round2(base + rng.int(1, 5));
    });
    tuplas.push(tupla);
  }

  const arr = tuplas.map((tupla) => ({
    campos: saidas.map((s, i) => ({ nome: s.nome, unidade: s.unidade, valor: tupla[i] as Valor })),
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
