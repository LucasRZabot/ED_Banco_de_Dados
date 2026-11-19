import { onlyDigits } from "./cnpj";

export function normalizeDigitableLine(value: string) {
  return onlyDigits(value);
}

/** Módulo 10 da linha digitável (campos 1–3 do boleto bancário e convênio 6/7). */
export function modulo10(block: string) {
  let sum = 0;
  let multiplier = 2;
  for (let i = block.length - 1; i >= 0; i--) {
    let n = Number(block[i]) * multiplier;
    if (n > 9) n -= 9;
    sum += n;
    multiplier = multiplier === 2 ? 1 : 2;
  }
  return (10 - (sum % 10)) % 10;
}

/** DAC do boleto bancário (FEBRABAN): 11 − resto; 0/10/11 → 1. */
export function modulo11Bank(block: string) {
  let sum = 0;
  let weight = 2;
  for (let i = block.length - 1; i >= 0; i--) {
    sum += Number(block[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const dv = 11 - (sum % 11);
  if (dv === 0 || dv === 10 || dv === 11) return 1;
  return dv;
}

/** DAC de arrecadação/convênio: 11 − resto; 0/10/11 → 0. */
export function modulo11Convenio(block: string) {
  let sum = 0;
  let weight = 2;
  for (let i = block.length - 1; i >= 0; i--) {
    sum += Number(block[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const dv = 11 - (sum % 11);
  if (dv === 0 || dv === 10 || dv === 11) return 0;
  return dv;
}

export type DigitableLineResult =
  | { ok: true; digits: string; kind: "bank" | "convenio" }
  | { ok: false; error: string };

function fail(error: string): DigitableLineResult {
  return { ok: false, error };
}

function validateBankLine(digits: string): DigitableLineResult {
  const c1 = digits.slice(0, 9);
  const dv1 = Number(digits[9]);
  const c2 = digits.slice(10, 20);
  const dv2 = Number(digits[20]);
  const c3 = digits.slice(21, 31);
  const dv3 = Number(digits[31]);
  const general = Number(digits[32]);
  const campo5 = digits.slice(33, 47);

  if (modulo10(c1) !== dv1 || modulo10(c2) !== dv2 || modulo10(c3) !== dv3) {
    return fail("Dígito verificador da linha digitável inválido.");
  }

  const bank = c1.slice(0, 3);
  const currency = c1.slice(3, 4);
  const free = c1.slice(4, 9) + c2 + c3;
  const factor = campo5.slice(0, 4);
  const amount = campo5.slice(4, 14);
  const barcodeWithoutDv = bank + currency + factor + amount + free;
  if (modulo11Bank(barcodeWithoutDv) !== general) {
    return fail("Dígito verificador geral da linha digitável inválido.");
  }
  return { ok: true, digits, kind: "bank" };
}

function validateConvenioLine(digits: string): DigitableLineResult {
  const blocks = [0, 12, 24, 36].map((i) => digits.slice(i, i + 12));
  const barcode = blocks.map((b) => b.slice(0, 11)).join("");
  if (barcode[0] !== "8") {
    return fail("Linha de convênio deve começar com 8.");
  }
  const valueId = barcode[2];
  const fieldDv =
    valueId === "6" || valueId === "7"
      ? modulo10
      : valueId === "8" || valueId === "9"
        ? modulo11Convenio
        : null;
  if (!fieldDv) return fail("Identificador de valor da linha de convênio inválido.");

  for (const block of blocks) {
    const body = block.slice(0, 11);
    const dv = Number(block[11]);
    if (fieldDv(body) !== dv) return fail("Dígito verificador da linha digitável inválido.");
  }

  const withoutGeneral = `${barcode.slice(0, 3)}0${barcode.slice(4)}`;
  if (fieldDv(withoutGeneral) !== Number(barcode[3])) {
    return fail("Dígito verificador geral da linha de convênio inválido.");
  }
  return { ok: true, digits, kind: "convenio" };
}

export function validateDigitableLine(value: string): DigitableLineResult {
  const digits = normalizeDigitableLine(value);
  if (digits.length === 47) return validateBankLine(digits);
  if (digits.length === 48) return validateConvenioLine(digits);
  return fail("A linha digitável deve ter 47 (boleto) ou 48 (convênio) dígitos.");
}

/** Monta uma linha bancária 47 dígitos válida (testes e fixtures). */
export function buildBankDigitableLine(opts?: {
  bank?: string;
  factor?: string;
  amountCents?: string;
  free?: string;
}) {
  const bank = opts?.bank ?? "237";
  const currency = "9";
  const factor = (opts?.factor ?? "1000").padStart(4, "0").slice(0, 4);
  const amount = (opts?.amountCents ?? "0000012345").padStart(10, "0").slice(0, 10);
  const free = (opts?.free ?? "1".repeat(25)).padEnd(25, "0").slice(0, 25);
  const barcodeWithoutDv = bank + currency + factor + amount + free;
  const general = String(modulo11Bank(barcodeWithoutDv));
  const c1 = bank + currency + free.slice(0, 5);
  const c2 = free.slice(5, 15);
  const c3 = free.slice(15, 25);
  return c1 + modulo10(c1) + c2 + modulo10(c2) + c3 + modulo10(c3) + general + factor + amount;
}

/** Monta uma linha de convênio 48 dígitos válida (identificador 6 = módulo 10). */
export function buildConvenioDigitableLine() {
  const rest40 = `${"00000001234"}${"1".repeat(29)}`;
  const withoutGeneral = `8160${rest40}`;
  const general = String(modulo10(withoutGeneral));
  const barcode = `816${general}${rest40}`;
  const chunks = [0, 11, 22, 33].map((i) => barcode.slice(i, i + 11));
  return chunks.map((c) => c + String(modulo10(c))).join("");
}
