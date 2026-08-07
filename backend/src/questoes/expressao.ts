// Avaliador de expressões aritméticas (+ - * / ^, parênteses e funções), sem usar eval().
// Aceita letras latinas e gregas nos nomes de variáveis (ex.: F/m, 2*ρ1*ρ2/(ρ1+ρ2), H^3).
// Funções trigonométricas trabalham em GRAUS (não radianos) — sin(30), cos(90-θ), etc.
const FUNCOES: Record<string, (x: number) => number> = {
  sin: (x) => Math.sin((x * Math.PI) / 180),
  cos: (x) => Math.cos((x * Math.PI) / 180),
  tan: (x) => Math.tan((x * Math.PI) / 180),
  asin: (x) => (Math.asin(x) * 180) / Math.PI,
  acos: (x) => (Math.acos(x) * 180) / Math.PI,
  atan: (x) => (Math.atan(x) * 180) / Math.PI,
  sqrt: (x) => Math.sqrt(x),
  abs: (x) => Math.abs(x),
  ln: (x) => Math.log(x),
  log: (x) => Math.log10(x),
};

export function avaliarExpressao(expr: string, vars: Record<string, number>): number {
  const s = expr.replace(/\s+/g, "");
  let i = 0;

  function peek() { return s[i]; }

  function parseNumber(): number {
    const start = i;
    while (i < s.length && /[0-9.,]/.test(s[i])) i++;
    const bruto = s.slice(start, i).replace(",", "."); // aceita vírgula como separador decimal (padrão BR)
    return parseFloat(bruto);
  }

  // lê um identificador (nome de variável OU de função) e decide qual é pelo que vem depois
  function parseIdentOuFuncao(): number {
    const start = i;
    while (i < s.length && /[A-Za-zΑ-Ωα-ω0-9_]/.test(s[i])) i++;
    const nome = s.slice(start, i);

    if (peek() === "(") {
      i++; // consome "("
      const argumento = parseExpr();
      if (peek() !== ")") throw new Error(`Parêntese não fechado na função "${nome}"`);
      i++;
      const fn = FUNCOES[nome.toLowerCase()];
      if (!fn) throw new Error(`Função desconhecida: "${nome}". Disponíveis: ${Object.keys(FUNCOES).join(", ")}`);
      return fn(argumento);
    }

    if (!(nome in vars)) throw new Error(`Variável desconhecida: "${nome}"`);
    return vars[nome];
  }

  function parsePrimary(): number {
    if (peek() === "(") {
      i++;
      const v = parseExpr();
      if (peek() !== ")") throw new Error("Parêntese não fechado");
      i++;
      return v;
    }
    if (/[0-9.]/.test(peek())) return parseNumber();
    if (/[A-Za-zΑ-Ωα-ω_]/.test(peek())) return parseIdentOuFuncao();
    throw new Error("Expressão inválida perto de: " + s.slice(i));
  }

  // unário: -X ou +X (tem precedência MENOR que potência, então -H^2 = -(H^2), igual na matemática normal)
  function parseUnary(): number {
    if (peek() === "-") { i++; return -parseUnary(); }
    if (peek() === "+") { i++; return parseUnary(); }
    return parsePower();
  }

  // potência: H^3, com ^ associando da direita pra esquerda (2^3^2 = 2^(3^2))
  function parsePower(): number {
    const base = parsePrimary();
    if (peek() === "^") {
      i++;
      const expoente = parseUnary();
      return Math.pow(base, expoente);
    }
    return base;
  }

  function parseTerm(): number {
    let v = parseUnary();
    while (peek() === "*" || peek() === "/") {
      const op = s[i]; i++;
      const r = parseUnary();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }

  function parseExpr(): number {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = s[i]; i++;
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  if (s.length === 0) throw new Error("Fórmula vazia");
  const result = parseExpr();
  if (i < s.length) throw new Error("Caracteres inesperados: " + s.slice(i));
  if (!isFinite(result)) throw new Error("Resultado inválido (divisão por zero?)");
  return result;
}
