import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
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

const PORT = process.env.PORT ? Number(process.env.PORT) : 3333;
app.listen(PORT, () => {
  console.log(`Prova-Mestre backend rodando em http://localhost:${PORT}`);
});
