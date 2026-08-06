import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { prisma } from "./db";
import { QUESTOES_PADRAO } from "./questoes/padrao";
import { questoesRouter } from "./routes/questoes";
import { provasRouter } from "./routes/provas";
import { alunoExamRouter } from "./routes/alunoExam";
import { alunosRouter } from "./routes/alunos";
import { turmasRouter } from "./routes/turmas";

const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" })); // aumentado pra caber imagens de questões em base64

// Protege a área do professor com usuário/senha (HTTP Basic Auth). A rota do
// aluno (/api/prova/*) e os arquivos estáticos de aluno.html continuam públicos
// — só o painel do professor (turmas, alunos, questões, provas-mestre) exige login.
function protegerProfessor(req: express.Request, res: express.Response, next: express.NextFunction) {
  const senhaEsperada = process.env.PROFESSOR_SENHA;
  if (!senhaEsperada) return next(); // se a senha não foi configurada no Render, não bloqueia (evita travar acidentalmente)

  const usuarioEsperado = process.env.PROFESSOR_USUARIO || "professor";
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Prova-Mestre - Area do professor"');
    return res.status(401).send("Autenticação necessária.");
  }

  const [usuario, senha] = Buffer.from(auth.slice(6), "base64").toString().split(":");
  if (usuario !== usuarioEsperado || senha !== senhaEsperada) {
    res.set("WWW-Authenticate", 'Basic realm="Prova-Mestre - Area do professor"');
    return res.status(401).send("Credenciais inválidas.");
  }

  next();
}

app.use("/api/questoes", protegerProfessor, questoesRouter);
app.use("/api/provas-mestre", protegerProfessor, provasRouter);
app.use("/api/prova", alunoExamRouter);
app.use("/api/alunos", protegerProfessor, alunosRouter);
app.use("/api/turmas", protegerProfessor, turmasRouter);

// serve o frontend (arquivos estáticos, sem build step)
app.use(express.static(path.join(__dirname, "..", "public")));

// middleware de erro global: qualquer erro (ex.: Prisma reclamando que uma
// tabela não existe porque a migration não rodou) cai aqui e vira uma
// resposta JSON clara, em vez da requisição travar até o Render devolver 502.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Erro não tratado:", err);
  res.status(500).json({ erro: err?.message || "Erro interno no servidor." });
});

// Popula o banco de QUESTÕES na primeira vez que o servidor liga (só se estiver
// vazio). Não populamos mais alunos automaticamente — a turma real é cadastrada
// pelo professor na tela "Alunos". Isso evita depender de um terminal manual,
// necessário porque o Shell do Render só existe em planos pagos.
async function garantirDadosIniciais() {
  const totalQuestoes = await prisma.questao.count();
  if (totalQuestoes === 0) {
    console.log("Banco de questões vazio — cadastrando questões padrão...");
    for (const q of QUESTOES_PADRAO) {
      await prisma.questao.create({
        data: {
          tema: q.tema,
          dificuldade: q.dificuldade,
          enunciado: q.enunciado,
          variaveis: q.variaveis as any,
          etapas: q.etapas as any,
        },
      });
    }
  }
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 3333;

garantirDadosIniciais()
  .catch((e) => {
    // Não derruba o servidor por causa disso — só loga. Se o banco ainda não
    // tiver as tabelas (schema pendente), as rotas vão responder com um erro
    // claro (graças ao middleware acima) em vez do servidor cair.
    console.error("Falha ao garantir dados iniciais (o schema já foi aplicado no banco?):", e);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Prova-Mestre backend rodando em http://localhost:${PORT}`);
    });
  });
