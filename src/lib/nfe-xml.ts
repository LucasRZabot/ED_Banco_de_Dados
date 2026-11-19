import { onlyDigits } from "@/lib/validators/cnpj";

export type NfeXmlData = {
  accessKey: string | null;
  number: string | null;
  series: string | null;
  issueDate: string | null;
  amount: string | null;
  supplierCnpj: string | null;
  supplierLegalName: string | null;
};

export type NfeXmlResult = { ok: true; data: NfeXmlData } | { ok: false; error: string };

function tag(xml: string, name: string) {
  const re = new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}>`, "i");
  const m = xml.match(re);
  return m?.[1]?.trim() || null;
}

function firstTag(xml: string, names: string[]) {
  for (const name of names) {
    const v = tag(xml, name);
    if (v) return v;
  }
  return null;
}

function ymd(raw: string | null) {
  if (!raw) return null;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

function money(raw: string | null) {
  if (!raw) return null;
  const n = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

/** Extrai número, série, chave, emissão, valor e emitente de um XML NF-e (nfeProc ou NFe). */
export function parseNfeXml(xml: string): NfeXmlResult {
  const text = xml.replace(/^\uFEFF/, "").trim();
  if (!text.startsWith("<")) return { ok: false, error: "O arquivo não parece um XML de NF-e." };

  const idKey = text.match(/Id\s*=\s*["']NFe(\d{44})["']/i)?.[1] ?? null;
  const chNFe = onlyDigits(firstTag(text, ["chNFe"]) ?? "");
  const accessKey = idKey ?? (chNFe.length === 44 ? chNFe : null);

  const number = firstTag(text, ["nNF"]);
  const series = firstTag(text, ["serie"]);
  const issueDate = ymd(firstTag(text, ["dhEmi", "dEmi"]));
  const amount = money(firstTag(text, ["vNF"]));
  const supplierCnpj = onlyDigits(firstTag(text, ["CNPJ"]) ?? "") || null;
  const supplierLegalName = firstTag(text, ["xNome"]);

  if (!number && !accessKey && !supplierCnpj) {
    return { ok: false, error: "XML sem os campos da NF-e (número, chave ou CNPJ do emitente)." };
  }

  return {
    ok: true,
    data: {
      accessKey,
      number,
      series,
      issueDate,
      amount,
      supplierCnpj: supplierCnpj && supplierCnpj.length === 14 ? supplierCnpj : null,
      supplierLegalName,
    },
  };
}
