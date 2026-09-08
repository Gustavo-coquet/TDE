/**
 * Script pra cadastrar de uma vez 5 questões de Equação do 1º grau e Inequação.
 *
 * Como rodar (uma vez só):
 *   1. No Render, em Settings > Build, troque temporariamente o Start Command para:
 *        npx prisma db push --accept-data-loss && node dist/seedMatematica.js && npm start
 *   2. Faça o deploy, espere ficar "Live" e confira nos logs que as questões foram criadas.
 *   3. Volte o Start Command para o normal:
 *        npx prisma db push --accept-data-loss && npm start
 *
 * O script é seguro pra rodar mais de uma vez: ele pula as questões que já existem
 * (compara disciplina + assunto + enunciado), então não cria duplicatas.
 */
import "dotenv/config";
import { prisma } from "./db";

const DISCIPLINA = "Matemática";

const QUESTOES = [
  // ---------------------------------------------------------------- 1
  {
    assunto: "Equação do 1º grau — forma simples",
    dificuldade: 1,
    enunciado:
      "Resolva a equação do 1º grau abaixo, determinando o valor de **x**:\n\n" +
      "{a}x + {b} = {c}",
    variaveis: [
      { nome: "a", min: 2, max: 9, decimais: 0 },
      { nome: "b", min: 1, max: 20, decimais: 0 },
      { nome: "c", min: 21, max: 80, decimais: 0 },
    ],
    etapas: [
      { nome: "x", formula: "(c-b)/a", decimais: 2, unidade: "", saida: true },
    ],
    formatoResposta: "x = {x}",
  },

  // ---------------------------------------------------------------- 2
  {
    assunto: "Equação do 1º grau — com parênteses",
    dificuldade: 2,
    enunciado:
      "Resolva a equação abaixo, determinando o valor de **x**:\n\n" +
      "{a}(x + {b}) = {c}(x + {d})",
    variaveis: [
      { nome: "a", min: 4, max: 9, decimais: 0 },
      { nome: "b", min: 1, max: 12, decimais: 0 },
      { nome: "c", min: 2, max: 3, decimais: 0 }, // sempre menor que "a", pra não dar divisão por zero
      { nome: "d", min: 1, max: 12, decimais: 0 },
    ],
    etapas: [
      { nome: "x", formula: "(c*d - a*b)/(a - c)", decimais: 2, unidade: "", saida: true },
    ],
    formatoResposta: "x = {x}",
  },

  // ---------------------------------------------------------------- 3
  {
    assunto: "Inequação do 1º grau",
    dificuldade: 2,
    enunciado:
      "Resolva a inequação abaixo e indique o conjunto solução:\n\n" +
      "{a}x + {b} > {c}\n\n" +
      "_Atenção: lembre-se de inverter o sinal da desigualdade ao dividir por um número negativo._",
    variaveis: [
      { nome: "a", min: -8, max: 8, decimais: 0 },
      { nome: "b", min: 1, max: 20, decimais: 0 },
      { nome: "c", min: 21, max: 60, decimais: 0 },
    ],
    etapas: [
      { nome: "limite", formula: "(c-b)/a", decimais: 2, unidade: "", saida: false },
      {
        nome: "solucao",
        // se "a" for negativo, a desigualdade inverte
        formula: 'se(a>0; "x > "; "x < ") + limite',
        decimais: 2,
        unidade: "",
        saida: true,
      },
    ],
    formatoResposta: "{solucao}",
  },

  // ---------------------------------------------------------------- 4
  {
    assunto: "Inequação produto — estudo de sinal",
    dificuldade: 3,
    enunciado:
      "Faça o estudo de sinal e resolva a inequação abaixo:\n\n" +
      "(x − {r1}) · (x − {r2}) **<** 0\n\n" +
      "Indique o intervalo em que o produto é negativo.",
    variaveis: [
      { nome: "r1", min: -9, max: 4, decimais: 0 },
      { nome: "r2", min: 5, max: 15, decimais: 0 },
    ],
    etapas: [
      { nome: "menor", formula: "min(r1;r2)", decimais: 0, unidade: "", saida: false },
      { nome: "maior", formula: "max(r1;r2)", decimais: 0, unidade: "", saida: false },
      {
        nome: "solucao",
        formula: 'menor + " < x < " + maior',
        decimais: 0,
        unidade: "",
        saida: true,
      },
    ],
    formatoResposta: "{solucao}",
  },

  // ---------------------------------------------------------------- 5
  {
    assunto: "Inequação quociente — estudo de sinal",
    dificuldade: 3,
    enunciado:
      "Faça o estudo de sinal e resolva a inequação quociente abaixo:\n\n" +
      "(x − {r1}) / (x − {r2}) **>** 0\n\n" +
      "Indique o conjunto solução, lembrando que o denominador não pode ser zero.",
    variaveis: [
      { nome: "r1", min: -9, max: 3, decimais: 0 },
      { nome: "r2", min: 4, max: 14, decimais: 0 },
    ],
    etapas: [
      { nome: "menor", formula: "min(r1;r2)", decimais: 0, unidade: "", saida: false },
      { nome: "maior", formula: "max(r1;r2)", decimais: 0, unidade: "", saida: false },
      {
        nome: "solucao",
        formula: '"x < " + menor + " ou x > " + maior',
        decimais: 0,
        unidade: "",
        saida: true,
      },
    ],
    formatoResposta: "{solucao}",
  },
];

async function main() {
  console.log(`Cadastrando ${QUESTOES.length} questões de ${DISCIPLINA}...\n`);
  let criadas = 0;
  let puladas = 0;

  for (const q of QUESTOES) {
    const jaExiste = await prisma.questao.findFirst({
      where: { disciplina: DISCIPLINA, assunto: q.assunto, enunciado: q.enunciado },
    });

    if (jaExiste) {
      console.log(`  [pulada] já existe: ${q.assunto}`);
      puladas++;
      continue;
    }

    await prisma.questao.create({
      data: {
        disciplina: DISCIPLINA,
        assunto: q.assunto,
        dificuldade: q.dificuldade,
        enunciado: q.enunciado,
        variaveis: q.variaveis as any,
        etapas: q.etapas as any,
        formatoResposta: q.formatoResposta,
      },
    });
    console.log(`  [criada]  ${q.assunto}`);
    criadas++;
  }

  console.log(`\nPronto: ${criadas} criada(s), ${puladas} pulada(s) por já existirem.`);
}

main()
  .catch((e) => {
    console.error("Erro ao cadastrar questões:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
