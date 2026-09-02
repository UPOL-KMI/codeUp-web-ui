/**
 * An exercise's score as an expression (T-025).
 *
 * core-api's third score calculator, `universal`, stores a small expression tree over the test
 * results: `{type: "avg", children: [...]}`, `{type: "test-result", test: "Test 1"}`,
 * `{type: "value", value: 0.5}`, and seven operators between them. The legacy app edits that tree
 * with a tree: three thousand lines of node forms, drag targets and placeholder nodes.
 *
 * **This edits it as text**, and parses back (DEC-109). The grammar is smaller than the editor
 * would be -- eleven node types, four infix operators and parentheses -- and it buys three things
 * a tree cannot: an expression can be read at a glance, it can be pasted between exercises, and
 * the whole thing is a pair of pure functions with a round-trip test rather than a UI somebody has
 * to click through to know whether it works.
 *
 * A **test is written as a quoted string** (`"Test 1"`), because test names contain spaces, dots
 * and brackets -- core-api's own rule allows `-a-zA-Z0-9_()[].! ` -- and nothing else in the
 * grammar is quoted, so the quoting is unambiguous rather than decorative.
 */
export type ScoreNode =
  | { type: "value"; value: number }
  | { type: "test-result"; test: string }
  | { type: "neg" | "clamp"; children: ScoreNode[] }
  | { type: "sub" | "div"; children: ScoreNode[] }
  | { type: "sum" | "mul" | "avg" | "min" | "max"; children: ScoreNode[] };

/** Variadic functions, written as calls. `sum` and `mul` are printed infix instead. */
export const SCORE_FUNCTIONS = ["avg", "min", "max", "sum", "mul"] as const;

export class ScoreExpressionError extends Error {
  /** Character offset the parser gave up at, for pointing at the problem. */
  readonly at: number;
  constructor(message: string, at: number) {
    super(message);
    this.name = "ScoreExpressionError";
    this.at = at;
  }
}

interface Token {
  kind: "number" | "name" | "string" | "punct";
  text: string;
  at: number;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index]!;
    if (/\s/.test(character)) {
      index++;
      continue;
    }
    if (character === '"') {
      const end = source.indexOf('"', index + 1);
      if (end < 0) throw new ScoreExpressionError("unterminated-test", index);
      tokens.push({ kind: "string", text: source.slice(index + 1, end), at: index });
      index = end + 1;
      continue;
    }
    if (/[0-9]/.test(character) || (character === "." && /[0-9]/.test(source[index + 1] ?? ""))) {
      const match = /^[0-9]*\.?[0-9]+/.exec(source.slice(index))!;
      tokens.push({ kind: "number", text: match[0], at: index });
      index += match[0].length;
      continue;
    }
    if (/[a-zA-Z_]/.test(character)) {
      const match = /^[a-zA-Z_][a-zA-Z0-9_-]*/.exec(source.slice(index))!;
      tokens.push({ kind: "name", text: match[0], at: index });
      index += match[0].length;
      continue;
    }
    if ("+-*/(),".includes(character)) {
      tokens.push({ kind: "punct", text: character, at: index });
      index++;
      continue;
    }
    throw new ScoreExpressionError("unexpected-character", index);
  }
  return tokens;
}

/**
 * Recursive descent, lowest precedence outwards: `+ -`, then `* /`, then unary `-`, then atoms.
 *
 * `a + b + c` becomes one `sum` of three rather than nested pairs, and the same for `*`: that is
 * how core-api's own `avg`/`sum` nodes are shaped, and a tree of nested binaries would print back
 * with parentheses nobody wrote. `-` and `/` stay binary and left-associative, because `sub` and
 * `div` take exactly two children.
 */
export function parseScoreExpression(source: string): ScoreNode {
  const tokens = tokenize(source);
  let position = 0;

  const peek = () => tokens[position];
  const eat = (text: string) => {
    if (peek()?.kind === "punct" && peek()!.text === text) {
      position++;
      return true;
    }
    return false;
  };
  const expect = (text: string) => {
    if (!eat(text)) throw new ScoreExpressionError("expected", peek()?.at ?? source.length);
  };

  function parseSum(): ScoreNode {
    let left = parseProduct();
    for (;;) {
      if (eat("+")) {
        const right = parseProduct();
        left =
          left.type === "sum"
            ? { type: "sum", children: [...left.children, right] }
            : { type: "sum", children: [left, right] };
      } else if (eat("-")) {
        left = { type: "sub", children: [left, parseProduct()] };
      } else {
        return left;
      }
    }
  }

  function parseProduct(): ScoreNode {
    let left = parseUnary();
    for (;;) {
      if (eat("*")) {
        const right = parseUnary();
        left =
          left.type === "mul"
            ? { type: "mul", children: [...left.children, right] }
            : { type: "mul", children: [left, right] };
      } else if (eat("/")) {
        left = { type: "div", children: [left, parseUnary()] };
      } else {
        return left;
      }
    }
  }

  function parseUnary(): ScoreNode {
    if (eat("-")) return { type: "neg", children: [parseUnary()] };
    return parseAtom();
  }

  function parseAtom(): ScoreNode {
    const token = peek();
    if (!token) throw new ScoreExpressionError("unexpected-end", source.length);

    if (token.kind === "number") {
      position++;
      return { type: "value", value: Number(token.text) };
    }
    if (token.kind === "string") {
      position++;
      return { type: "test-result", test: token.text };
    }
    if (token.kind === "punct" && token.text === "(") {
      position++;
      const inner = parseSum();
      expect(")");
      return inner;
    }
    if (token.kind === "name") {
      position++;
      const name = token.text;
      expect("(");
      const children: ScoreNode[] = [];
      if (!eat(")")) {
        do children.push(parseSum());
        while (eat(","));
        expect(")");
      }
      if (name === "clamp") {
        if (children.length !== 1) throw new ScoreExpressionError("clamp-arity", token.at);
        return { type: "clamp", children };
      }
      if ((SCORE_FUNCTIONS as readonly string[]).includes(name)) {
        if (children.length === 0) throw new ScoreExpressionError("empty-call", token.at);
        return { type: name as "avg", children };
      }
      throw new ScoreExpressionError("unknown-function", token.at);
    }
    throw new ScoreExpressionError("unexpected-token", token.at);
  }

  const root = parseSum();
  if (position < tokens.length) throw new ScoreExpressionError("trailing", tokens[position]!.at);
  return root;
}

/** Binding strength, so the printer parenthesises only where it must. */
const PRECEDENCE: Record<string, number> = { sum: 1, sub: 1, mul: 2, div: 2, neg: 3 };

export function printScoreExpression(node: ScoreNode): string {
  const render = (current: ScoreNode, parent: number, isRightOperand = false): string => {
    const own = PRECEDENCE[current.type] ?? 4;
    const wrap = (text: string) =>
      own < parent || (own === parent && isRightOperand) ? `(${text})` : text;

    switch (current.type) {
      case "value":
        return String(current.value);
      case "test-result":
        return `"${current.test}"`;
      case "neg":
        return wrap(`-${render(current.children[0]!, own)}`);
      // A `sum` or `mul` of one child has no operator to print, and printing just the child
      // would parse back as the child rather than as the node core-api stores. Degenerate, but it
      // is a tree core-api accepts, so the call form keeps the round trip exact.
      case "sum":
        return current.children.length < 2
          ? `sum(${render(current.children[0]!, 0)})`
          : wrap(current.children.map((child) => render(child, own)).join(" + "));
      case "mul":
        return current.children.length < 2
          ? `mul(${render(current.children[0]!, 0)})`
          : wrap(current.children.map((child) => render(child, own)).join(" * "));
      case "sub":
        return wrap(
          `${render(current.children[0]!, own)} - ${render(current.children[1]!, own, true)}`,
        );
      case "div":
        return wrap(
          `${render(current.children[0]!, own)} / ${render(current.children[1]!, own, true)}`,
        );
      default:
        return `${current.type}(${current.children.map((child) => render(child, 0)).join(", ")})`;
    }
  };
  return render(node, 0);
}

/** Every test the expression names, in the order it names them. */
export function referencedTests(node: ScoreNode): string[] {
  const found: string[] = [];
  const walk = (current: ScoreNode) => {
    if (current.type === "test-result") {
      found.push(current.test);
      return;
    }
    if ("children" in current) current.children.forEach(walk);
  };
  walk(node);
  return found;
}

/**
 * The expression a uniform or weighted score is *already* equivalent to -- so switching to a
 * custom one starts from what the exercise does today rather than from a blank field.
 *
 * Equal weights are a plain average; unequal ones are the sum of each result times its weight,
 * over the total. That is the shape the legacy app writes and the one `extractWeights` below can
 * read back, which is what makes the switch reversible in both directions.
 */
export function expressionFromWeights(weights: Record<string, number>): ScoreNode | null {
  const names = Object.keys(weights);
  if (names.length === 0) return null;

  const values = names.map((name) => weights[name]!);
  if (values.every((value) => value === values[0])) {
    return { type: "avg", children: names.map((test) => ({ type: "test-result", test })) };
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    type: "div",
    children: [
      {
        type: "sum",
        children: names.map((test) => ({
          type: "mul",
          children: [
            { type: "value", value: weights[test]! },
            { type: "test-result", test },
          ],
        })),
      },
      { type: "value", value: total },
    ],
  };
}

/**
 * The weights an expression is equivalent to, where it happens to be an average -- so switching
 * *away* from a custom score can say what it will become instead of only what it will lose.
 *
 * Recognises exactly the two shapes `expressionFromWeights` produces, and nothing else: guessing
 * at a general expression would be re-deriving algebra, and a wrong guess silently rewrites how a
 * live exercise is graded. Anything it does not recognise returns null, and the screen then says
 * the expression will be lost rather than pretending it can be converted.
 */
export function extractWeights(node: ScoreNode): Record<string, number> | null {
  if (node.type === "avg" && node.children.every((child) => child.type === "test-result")) {
    return Object.fromEntries(
      node.children.map((child) => [(child as { test: string }).test, 100]),
    );
  }

  if (node.type === "div" && node.children.length === 2) {
    const [numerator, divisor] = node.children;
    if (numerator?.type !== "sum" || divisor?.type !== "value") return null;

    const weights: Record<string, number> = {};
    for (const term of numerator.children) {
      if (term.type === "test-result") {
        weights[term.test] = 1;
        continue;
      }
      if (term.type !== "mul" || term.children.length !== 2) return null;
      const [first, second] = term.children;
      const weight = first?.type === "value" ? first : second?.type === "value" ? second : null;
      const test =
        first?.type === "test-result" ? first : second?.type === "test-result" ? second : null;
      if (!weight || !test) return null;
      weights[test.test] = weight.value;
    }

    const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
    // The divisor has to be the total, or the expression is a weighted average of something else.
    return Math.abs(total - divisor.value) < 1e-9 ? weights : null;
  }

  return null;
}
