import { Rng } from "../rng";

/**
 * Cada "tipo" de questão define:
 *  - gerar(rng): sorteia os parâmetros dentro de faixas fixas (equivalente às
 *    "regras de geração / restrições matemáticas" descritas na arquitetura)
 *  - enunciado(params): monta o texto final substituindo os placeholders
 *  - respostaCorreta(params): calcula a resposta certa a partir dos parâmetros
 *
 * Isso é uma versão simplificada do motor simbólico (SymPy) descrito no
 * documento de arquitetura: aqui a fórmula já vem "compilada" em código,
 * em vez de ser interpretada dinamicamente a partir de uma string.
 * Para um sistema maior, o passo natural é mover cada `respostaCorreta`
 * para uma expressão avaliada por um motor simbólico no backend Python.
 */
export type Params = Record<string, number>;

export interface QuestaoTemplate {
  tipo: string;
  tema: string;
  dificuldade: number;
  unidade: string;
  gerar: (rng: Rng) => Params;
  enunciado: (p: Params) => string;
  respostaCorreta: (p: Params) => number;
}

export const TEMPLATES: Record<string, QuestaoTemplate> = {
  newton_2lei: {
    tipo: "newton_2lei",
    tema: "Mecânica — Leis de Newton",
    dificuldade: 2,
    unidade: "m/s²",
    gerar: (rng) => ({ F: 20 + rng.int(0, 16) * 2, m: 4 + rng.int(0, 6) }),
    enunciado: (p) =>
      `Um bloco de massa ${p.m} kg é empurrado por uma força horizontal de ${p.F} N sobre uma superfície sem atrito. Qual é a aceleração do bloco?`,
    respostaCorreta: (p) => round2(p.F / p.m),
  },
  mru_velocidade: {
    tipo: "mru_velocidade",
    tema: "Cinemática — MRU",
    dificuldade: 1,
    unidade: "km/h",
    gerar: (rng) => ({ d: 60 + rng.int(0, 12) * 10, t: 1 + rng.int(0, 3) }),
    enunciado: (p) =>
      `Um carro percorre ${p.d} km em ${p.t} horas, em movimento retilíneo uniforme. Qual é a sua velocidade média?`,
    respostaCorreta: (p) => round1(p.d / p.t),
  },
  calor_sensivel: {
    tipo: "calor_sensivel",
    tema: "Termologia — Calor sensível",
    dificuldade: 3,
    unidade: "°C",
    gerar: (rng) => ({ m: 100 + rng.int(0, 5) * 20, Q: 800 + rng.int(0, 10) * 100 }),
    enunciado: (p) =>
      `Uma massa de ${p.m} g de água recebe ${p.Q} cal de calor. Sabendo que o calor específico da água é 1 cal/g°C, qual a variação de temperatura?`,
    respostaCorreta: (p) => round1(p.Q / p.m),
  },
  juros_simples: {
    tipo: "juros_simples",
    tema: "Matemática Financeira — Juros simples",
    dificuldade: 2,
    unidade: "R$",
    gerar: (rng) => ({ C: 1000 + rng.int(0, 8) * 500, i: 2 + rng.int(0, 4), t: 3 + rng.int(0, 6) }),
    enunciado: (p) =>
      `Um capital de R$ ${p.C},00 é aplicado a juros simples de ${p.i}% ao mês, durante ${p.t} meses. Qual o valor total dos juros?`,
    respostaCorreta: (p) => round2((p.C * p.i * p.t) / 100),
  },
  lei_ohm: {
    tipo: "lei_ohm",
    tema: "Eletrodinâmica — Lei de Ohm",
    dificuldade: 2,
    unidade: "A",
    gerar: (rng) => ({ R: 10 + rng.int(0, 8) * 5, V: 20 + rng.int(0, 10) * 4 }),
    enunciado: (p) =>
      `Um resistor de ${p.R} Ω é submetido a uma tensão de ${p.V} V. Qual é a corrente elétrica que o percorre?`,
    respostaCorreta: (p) => round2(p.V / p.R),
  },
  media_aritmetica: {
    tipo: "media_aritmetica",
    tema: "Estatística — Média aritmética",
    dificuldade: 1,
    unidade: "pts",
    gerar: (rng) => ({ n: 3 + rng.int(0, 2), soma: 200 + rng.int(0, 15) * 10 }),
    enunciado: (p) =>
      `As notas de um aluno em ${p.n} provas foram somadas e totalizaram ${p.soma} pontos. Qual foi a média do aluno?`,
    respostaCorreta: (p) => round1(p.soma / p.n),
  },
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
