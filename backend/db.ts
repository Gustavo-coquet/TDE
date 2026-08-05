export interface QuestaoPadrao {
  tema: string;
  dificuldade: number;
  unidade: string;
  enunciado: string;
  variaveis: { nome: string; min: number; max: number; decimais: number }[];
  formula: string;
}

export const QUESTOES_PADRAO: QuestaoPadrao[] = [
  {
    tema: "Mecânica — Leis de Newton", dificuldade: 2, unidade: "m/s²",
    enunciado: "Um bloco de massa {m} kg é empurrado por uma força horizontal de {F} N sobre uma superfície sem atrito. Qual é a aceleração do bloco?",
    variaveis: [{ nome: "F", min: 20, max: 100, decimais: 0 }, { nome: "m", min: 4, max: 16, decimais: 0 }],
    formula: "F/m",
  },
  {
    tema: "Cinemática — MRU", dificuldade: 1, unidade: "km/h",
    enunciado: "Um carro percorre {d} km em {t} horas, em movimento retilíneo uniforme. Qual é a sua velocidade média?",
    variaveis: [{ nome: "d", min: 60, max: 180, decimais: 0 }, { nome: "t", min: 1, max: 4, decimais: 0 }],
    formula: "d/t",
  },
  {
    tema: "Termologia — Calor sensível", dificuldade: 3, unidade: "°C",
    enunciado: "Uma massa de {m} g de água recebe {Q} cal de calor. Sabendo que o calor específico da água é 1 cal/g°C, qual a variação de temperatura?",
    variaveis: [{ nome: "m", min: 100, max: 200, decimais: 0 }, { nome: "Q", min: 800, max: 1800, decimais: 0 }],
    formula: "Q/m",
  },
  {
    tema: "Matemática Financeira — Juros simples", dificuldade: 2, unidade: "R$",
    enunciado: "Um capital de R$ {C},00 é aplicado a juros simples de {i}% ao mês, durante {t} meses. Qual o valor total dos juros?",
    variaveis: [{ nome: "C", min: 1000, max: 5000, decimais: 0 }, { nome: "i", min: 2, max: 6, decimais: 0 }, { nome: "t", min: 3, max: 9, decimais: 0 }],
    formula: "(C*i*t)/100",
  },
  {
    tema: "Eletrodinâmica — Lei de Ohm", dificuldade: 2, unidade: "A",
    enunciado: "Um resistor de {R} Ω é submetido a uma tensão de {V} V. Qual é a corrente elétrica que o percorre?",
    variaveis: [{ nome: "R", min: 10, max: 50, decimais: 0 }, { nome: "V", min: 20, max: 60, decimais: 0 }],
    formula: "V/R",
  },
  {
    tema: "Estatística — Média aritmética", dificuldade: 1, unidade: "pts",
    enunciado: "As notas de um aluno em {n} provas foram somadas e totalizaram {soma} pontos. Qual foi a média do aluno?",
    variaveis: [{ nome: "n", min: 3, max: 5, decimais: 0 }, { nome: "soma", min: 200, max: 350, decimais: 0 }],
    formula: "soma/n",
  },
];
