import { Request, Response, NextFunction, RequestHandler } from "express";

// Express 4 não captura automaticamente erros de handlers async — se a Promise
// rejeitar (ex.: erro do Prisma porque a tabela não existe ainda), a requisição
// fica pendurada até o Render desistir e devolver 502, sem nenhuma mensagem útil.
// Esse wrapper garante que qualquer erro caia no middleware de erro abaixo,
// que responde com um JSON claro em vez de travar a requisição.
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
