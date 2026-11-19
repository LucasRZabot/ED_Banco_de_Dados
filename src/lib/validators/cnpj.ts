export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function dv(base: string, weights: number[]) {
  const sum = [...base].reduce((acc, digit, i) => acc + Number(digit) * weights[i]!, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCnpj(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  if (dv(digits.slice(0, 12), w1) !== Number(digits[12])) return false;
  if (dv(digits.slice(0, 13), w2) !== Number(digits[13])) return false;
  return true;
}

/** Gera um CNPJ válido a partir de 12 dígitos-base (útil em seed/testes). */
export function cnpjFromBase(base12: string) {
  const digits = onlyDigits(base12).padStart(12, "0").slice(0, 12);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = dv(digits, w1);
  const d2 = dv(`${digits}${d1}`, w2);
  return `${digits}${d1}${d2}`;
}

export function formatCnpj(value: string) {
  const d = onlyDigits(value).padEnd(14, " ").slice(0, 14);
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
