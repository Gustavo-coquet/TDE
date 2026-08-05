import { Rng, hashSeed } from "./rng";
import { avaliarExpressao } from "./questoes/expressao";

export interface VariavelDb {
  nome: string;
  min: number;
  max: number;
  decimais: number;
}

export interface QuestaoDb {
  id: string;
  enunciado: string;
  variaveis: VariavelDb[];
  formula: string;
}

export interface AlternativaGerada {
  letra: string;
  valor: number;
  correta: boolean;
}

export interface QuestaoIndividualGerada {
  questaoId: string;
  ordem: number;
  parametrosGerados: Record<string, number>;
  enunciadoFinal: string;
  alternativasFinal: AlternativaGerada[];
  respostaCorretaLetra: string;
}

/**
 * Gera a prova individual de um aluno a partir da Prova-Mestre.
 *
 *  1. Seed determinística = hash(provaMestreId + alunoId) -> reprodutível e auditável.
 *  2. Embaralha a ORDEM das questões (o conjunto de questões nunca muda).
 *  3. Para cada questão, sorteia parâmetros dentro das faixas definidas pelo professor.
 *  4. Recalcula resposta correta (avaliando a fórmula) + gera distratores plausíveis.
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
    const valores = gerarValores(q.variaveis, rng);
    const respostaCorreta = round2(avaliarExpressao(q.formula, valores));
    const enunciadoFinal = montarEnunciado(q.enunciado, valores);
    const alternativas = gerarAlternativas(respostaCorreta, rng);

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

export function gerarValores(variaveis: VariavelDb[], rng: Rng): Record<string, number> {
  const valores: Record<string, number> = {};
  for (const v of variaveis) {
    valores[v.nome] = v.decimais > 0 ? roundTo(rng.float(v.min, v.max), v.decimais) : rng.int(v.min, v.max);
  }
  return valores;
}

export function montarEnunciado(template: string, valores: Record<string, number>): string {
  let out = template;
  for (const [k, v] of Object.entries(valores)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

export function gerarAlternativas(respostaCorreta: number, rng: Rng): AlternativaGerada[] {
  const valores = new Set<number>([respostaCorreta]);
  const fatores = [0.5, 0.75, 1.25, 1.5, 2];

  let tentativas = 0;
  while (valores.size < 5 && tentativas < 80) {
    tentativas++;
    const fator = fatores[rng.int(0, fatores.length - 1)];
    const sinal = rng.int(0, 1) ? 1 : -1;
    const errado = round2(respostaCorreta * fator + sinal * rng.int(1, 3));
    if (errado > 0 && errado !== respostaCorreta && !valores.has(errado)) valores.add(errado);
  }

  const arr = Array.from(valores).map((valor) => ({ valor, correta: valor === respostaCorreta }));
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
