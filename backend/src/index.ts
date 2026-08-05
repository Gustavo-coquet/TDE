import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { prisma } from "./db";
import { TEMPLATES } from "./questoes/templates";
import { questoesRouter } from "./routes/questoes";
import { provasRouter } from "./routes/provas";
import { alunoExamRouter } from "./routes/alunoExam";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/questoes", questoesRouter);
app.use("/api/provas-mestre", provasRouter);
app.use("/api/prova", alunoExamRouter);

// serve o frontend (arquivos estáticos, sem build step)
app.use(express.static(path.join(__dirname, "..", "public")));

// middleware de erro global: qualquer erro (ex.: Prisma reclamando que uma
// tabela não existe porque a migration não rodou) cai aqui e vira uma
// resposta JSON clara, em vez da requisição travar até o Render devolver 502.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Erro não tratado:", err);
  res.status(500).json({ erro: err?.message || "Erro interno no servidor." });
});

// Popula o banco na primeira vez que o servidor liga (só se estiver vazio).
// Isso evita depender de rodar "npm run seed" manualmente por um terminal —
// necessário porque o Shell do Render só existe em planos pagos.
async function garantirDadosIniciais() {
  const totalQuestoes = await prisma.questao.count();
  if (totalQuestoes === 0) {
    console.log("Banco de questões vazio — cadastrando questões padrão...");
    for (const t of Object.values(TEMPLATES)) {
      await prisma.questao.create({
        data: { tema: t.tema, dificuldade: t.dificuldade, tipo: t.tipo, unidade: t.unidade },
      });
    }
  }

  const totalAlunos = await prisma.aluno.count();
  if (totalAlunos === 0) {
    console.log("Nenhum aluno cadastrado — cadastrando turma de exemplo...");
    const nomes = [
      "Ana Beatriz Souza", "Bruno Carvalho", "Camila Ferreira", "Diego Martins",
      "Elisa Nogueira", "Felipe Ramos", "Gabriela Lopes", "Henrique Alves",
    ];
    for (const nome of nomes) {
      await prisma.aluno.create({ data: { nome } });
    }
  }
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 3333;

garantirDadosIniciais()
  .catch((e) => {
    // Não derruba o servidor por causa disso — só loga. Se o banco ainda não
    // tiver as tabelas (migration pendente), as rotas vão responder com um
    // erro claro (graças ao middleware acima) em vez do servidor cair.
    console.error("Falha ao garantir dados iniciais (a migration já rodou?):", e);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Prova-Mestre backend rodando em http://localhost:${PORT}`);
    });
  });
