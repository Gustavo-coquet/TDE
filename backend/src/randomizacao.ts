import { Rng, hashSeed } from "./rng";
import { TEMPLATES, Params } from "./questoes/templates";

export interface QuestaoDb {
  id: string;
  tipo: string;
}

export interface AlternativaGerada {
  letra: string;
  valor: number;
  correta: boolean;
}

export interface QuestaoIndividualGerada {
  questaoId: string;
  ordem: number;
  parametrosGerados: Params;
  enunciadoFinal: string;
  alternativasFinal: AlternativaGerada[];
  respostaCorretaLetra: string;
}

/**
 * Gera a prova individual de um aluno a partir da Prova-Mestre.
 *
 *  1. Seed determinística = hash(provaMestreId + alunoId) -> reprodutível e auditável.
 *  2. Embaralha a ORDEM das questões (o conjunto de questões nunca muda).
 *  3. Para cada questão, sorteia parâmetros dentro das faixas do template.
 *  4. Recalcula resposta correta + gera distratores plausíveis.
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
    const template = TEMPLATES[q.tipo];
    if (!template) throw new Error(`Template desconhecido para tipo de questão: ${q.tipo}`);

    const params = template.gerar(rng);
    const respostaCorreta = template.respostaCorreta(params);
    const enunciadoFinal = template.enunciado(params);

    const alternativas = gerarAlternativas(respostaCorreta, rng);

    return {
      questaoId: q.id,
      ordem: idx,
      parametrosGerados: params,
      enunciadoFinal,
      alternativasFinal: alternativas,
      respostaCorretaLetra: alternativas.find((a) => a.correta)!.letra,
    };
  });

  return { seed: seedStr, questoes: questoesGeradas };
}

function gerarAlternativas(respostaCorreta: number, rng: Rng): AlternativaGerada[] {
  const valores = new Set<number>([respostaCorreta]);
  const fatores = [0.5, 0.75, 1.25, 1.5, 2];

  let tentativas = 0;
  while (valores.size < 4 && tentativas < 50) {
    tentativas++;
    const fator = fatores[rng.int(0, fatores.length - 1)];
    const sinal = rng.int(0, 1) ? 1 : -1;
    const errado = round2(respostaCorreta * fator + sinal * rng.int(1, 3));
    if (errado > 0 && !valores.has(errado)) valores.add(errado);
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
