export interface VariavelPadrao { nome: string; min: number; max: number; decimais: number }
export interface EtapaPadrao { nome: string; formula: string; decimais: number; unidade: string; saida: boolean }

export interface QuestaoPadrao {
  disciplina: string;
  assunto: string;
  dificuldade: number;
  enunciado: string;
  variaveis: VariavelPadrao[];
  etapas: EtapaPadrao[];
}

export const QUESTOES_PADRAO: QuestaoPadrao[] = [
  {
    disciplina: "Física", assunto: "Mecânica — Leis de Newton", dificuldade: 2,
    enunciado: "Um bloco de massa {m} kg é empurrado por uma força horizontal de {F} N sobre uma superfície sem atrito. Qual é a aceleração do bloco?",
    variaveis: [{ nome: "F", min: 20, max: 100, decimais: 0 }, { nome: "m", min: 4, max: 16, decimais: 0 }],
    etapas: [{ nome: "a", formula: "F/m", decimais: 2, unidade: "m/s²", saida: true }],
  },
  {
    disciplina: "Física", assunto: "Cinemática — MRU", dificuldade: 1,
    enunciado: "Um carro percorre {d} km em {t} horas, em movimento retilíneo uniforme. Qual é a sua velocidade média?",
    variaveis: [{ nome: "d", min: 60, max: 180, decimais: 0 }, { nome: "t", min: 1, max: 4, decimais: 0 }],
    etapas: [{ nome: "v", formula: "d/t", decimais: 1, unidade: "km/h", saida: true }],
  },
  {
    disciplina: "Física", assunto: "Termologia — Calor sensível", dificuldade: 3,
    enunciado: "Uma massa de {m} g de água recebe {Q} cal de calor. Sabendo que o calor específico da água é 1 cal/g°C, qual a variação de temperatura?",
    variaveis: [{ nome: "m", min: 100, max: 200, decimais: 0 }, { nome: "Q", min: 800, max: 1800, decimais: 0 }],
    etapas: [{ nome: "deltaT", formula: "Q/m", decimais: 1, unidade: "°C", saida: true }],
  },
  {
    disciplina: "Matemática", assunto: "Matemática Financeira — Juros simples", dificuldade: 2,
    enunciado: "Um capital de R$ {C},00 é aplicado a juros simples de {i}% ao mês, durante {t} meses. Qual o valor total dos juros?",
    variaveis: [{ nome: "C", min: 1000, max: 5000, decimais: 0 }, { nome: "i", min: 2, max: 6, decimais: 0 }, { nome: "t", min: 3, max: 9, decimais: 0 }],
    etapas: [{ nome: "J", formula: "(C*i*t)/100", decimais: 2, unidade: "R$", saida: true }],
  },
  {
    disciplina: "Física", assunto: "Eletrodinâmica — Lei de Ohm", dificuldade: 2,
    enunciado: "Um resistor de {R} Ω é submetido a uma tensão de {V} V. Qual é a corrente elétrica que o percorre?",
    variaveis: [{ nome: "R", min: 10, max: 50, decimais: 0 }, { nome: "V", min: 20, max: 60, decimais: 0 }],
    etapas: [{ nome: "i", formula: "V/R", decimais: 2, unidade: "A", saida: true }],
  },
  {
    disciplina: "Matemática", assunto: "Estatística — Média aritmética", dificuldade: 1,
    enunciado: "As notas de um aluno em {n} provas foram somadas e totalizaram {soma} pontos. Qual foi a média do aluno?",
    variaveis: [{ nome: "n", min: 3, max: 5, decimais: 0 }, { nome: "soma", min: 200, max: 350, decimais: 0 }],
    etapas: [{ nome: "media", formula: "soma/n", decimais: 1, unidade: "pts", saida: true }],
  },
  {
    disciplina: "Resistência dos Materiais", assunto: "Flexão (cálculo encadeado)", dificuldade: 4,
    enunciado: "Uma viga retangular tem base {b} cm e altura {h} cm, submetida a um momento fletor de {M} kN·cm. Calcule o momento de inércia da seção e a tensão normal máxima de flexão.",
    variaveis: [
      { nome: "b", min: 8, max: 20, decimais: 0 },
      { nome: "h", min: 15, max: 40, decimais: 0 },
      { nome: "M", min: 50, max: 300, decimais: 0 },
    ],
    etapas: [
      { nome: "I", formula: "(b*h*h*h)/12", decimais: 1, unidade: "cm⁴", saida: true },
      { nome: "c", formula: "h/2", decimais: 2, unidade: "cm", saida: false },
      { nome: "sigma", formula: "(M*c)/I", decimais: 3, unidade: "kN/cm²", saida: true },
    ],
  },
];
