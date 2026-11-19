"use client";

import { useActionState, useState } from "react";
import { FieldError } from "@/components/shared/field-error";
import { FileUpload } from "@/components/shared/file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { parseNfeXml } from "@/lib/nfe-xml";
import { formatCnpjDisplay } from "@/lib/format";
import { postInvoice } from "../actions";

type Supplier = { id: string; legalName: string; cnpj: string };
type Quote = { id: string; description: string | null; amount: { toString(): string }; supplier: { legalName: string } };
type Contract = { id: string; object: string; code: string | null; supplier: { legalName: string } };
type Ticket = { id: string; code: number; title: string };

export type InvoicePostDefaults = {
  number: string;
  series: string;
  accessKey: string;
  amount: string;
  issueDate: string;
  supplierId: string;
  supplierLegalName: string;
  supplierCnpj: string;
  quoteId: string;
  contractId: string;
  ticketId: string;
};

export function InvoicePostForm({
  invoiceId,
  suppliers,
  quotes,
  contracts,
  tickets,
  defaults,
  referenceDate,
}: {
  invoiceId: string;
  suppliers: Supplier[];
  quotes: Quote[];
  contracts: Contract[];
  tickets: Ticket[];
  defaults?: Partial<InvoicePostDefaults>;
  referenceDate?: string;
}) {
  const [state, action, pending] = useActionState(postInvoice, undefined);
  const [uploading, setUploading] = useState(false);
  const [supplierId, setSupplierId] = useState(defaults?.supplierId ?? "");
  const [number, setNumber] = useState(defaults?.number ?? "");
  const [series, setSeries] = useState(defaults?.series ?? "");
  const [accessKey, setAccessKey] = useState(defaults?.accessKey ?? "");
  const [amount, setAmount] = useState(defaults?.amount ?? "");
  const [issueDate, setIssueDate] = useState(defaults?.issueDate ?? "");
  const [legalName, setLegalName] = useState(defaults?.supplierLegalName ?? "");
  const [cnpj, setCnpj] = useState(defaults?.supplierCnpj ?? "");
  const [xmlNote, setXmlNote] = useState<string>();
  const errors = state?.fieldErrors;
  const busy = pending || uploading;
  const isNewSupplier = !supplierId;

  async function onXml(file: File) {
    const parsed = parseNfeXml(await file.text());
    if (!parsed.ok) {
      setXmlNote(parsed.error);
      return;
    }
    const d = parsed.data;
    if (d.number) setNumber(d.number);
    if (d.series) setSeries(d.series);
    if (d.accessKey) setAccessKey(d.accessKey);
    if (d.amount) setAmount(d.amount.replace(".", ","));
    if (d.issueDate) setIssueDate(d.issueDate);
    if (d.supplierCnpj) {
      const match = suppliers.find((s) => s.cnpj === d.supplierCnpj);
      if (match) {
        setSupplierId(match.id);
      } else {
        setSupplierId("");
        setCnpj(d.supplierCnpj);
        if (d.supplierLegalName) setLegalName(d.supplierLegalName);
      }
    } else if (d.supplierLegalName) {
      setLegalName(d.supplierLegalName);
    }
    setXmlNote("Campos preenchidos a partir do XML. Confira antes de lançar.");
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {xmlNote ? <p className="text-sm text-muted-foreground">{xmlNote}</p> : null}

      <div className="grid gap-2">
        <Label>XML da NF-e (pré-preenche o lançamento)</Label>
        <FileUpload
          name="xmlTokens"
          category="INVOICE_XML"
          multiple={false}
          accept="application/xml,text/xml,.xml"
          referenceDate={issueDate || referenceDate}
          onBusyChange={setUploading}
          onPicked={onXml}
        />
      </div>
      <div className="grid gap-2">
        <Label>PDF da nota (se ainda não houver)</Label>
        <FileUpload
          name="pdfTokens"
          category="INVOICE_PDF"
          multiple={false}
          accept="application/pdf"
          referenceDate={issueDate || referenceDate}
          onBusyChange={setUploading}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="number">Número</Label>
          <Input id="number" name="number" required value={number} onChange={(e) => setNumber(e.target.value)} />
          <FieldError messages={errors?.number} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="series">Série</Label>
          <Input id="series" name="series" required value={series} onChange={(e) => setSeries(e.target.value)} />
          <FieldError messages={errors?.series} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="issueDate">Emissão</Label>
          <Input
            id="issueDate"
            name="issueDate"
            type="date"
            required
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
          <FieldError messages={errors?.issueDate} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="amount">Valor (R$)</Label>
          <Input
            id="amount"
            name="amount"
            required
            inputMode="decimal"
            placeholder="1.234,56"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <FieldError messages={errors?.amount} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="accessKey">Chave de acesso (44 dígitos)</Label>
          <Input
            id="accessKey"
            name="accessKey"
            inputMode="numeric"
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
          />
          <FieldError messages={errors?.accessKey} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="supplierId">Fornecedor</Label>
        <NativeSelect
          id="supplierId"
          name="supplierId"
          className="w-full"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
        >
          <NativeSelectOption value="">Novo fornecedor</NativeSelectOption>
          {suppliers.map((s) => (
            <NativeSelectOption key={s.id} value={s.id}>
              {s.legalName} · {formatCnpjDisplay(s.cnpj)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {isNewSupplier ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="supplierLegalName">Razão social</Label>
            <Input
              id="supplierLegalName"
              name="supplierLegalName"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
            <FieldError messages={errors?.supplierLegalName} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="supplierCnpj">CNPJ</Label>
            <Input
              id="supplierCnpj"
              name="supplierCnpj"
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
            />
            <FieldError messages={errors?.supplierCnpj} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="quoteId">Orçamento (opcional)</Label>
          <NativeSelect id="quoteId" name="quoteId" className="w-full" defaultValue={defaults?.quoteId ?? ""}>
            <NativeSelectOption value="">Sem vínculo</NativeSelectOption>
            {quotes.map((q) => (
              <NativeSelectOption key={q.id} value={q.id}>
                {q.supplier.legalName} · {q.description ?? "Orçamento"}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contractId">Contrato (opcional)</Label>
          <NativeSelect id="contractId" name="contractId" className="w-full" defaultValue={defaults?.contractId ?? ""}>
            <NativeSelectOption value="">Sem vínculo</NativeSelectOption>
            {contracts.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.code ? `${c.code} · ` : ""}
                {c.object.slice(0, 40)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ticketId">Chamado (opcional)</Label>
          <NativeSelect id="ticketId" name="ticketId" className="w-full" defaultValue={defaults?.ticketId ?? ""}>
            <NativeSelectOption value="">Sem vínculo</NativeSelectOption>
            {tickets.map((t) => (
              <NativeSelectOption key={t.id} value={t.id}>
                #{t.code} {t.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      <Button type="submit" disabled={busy}>
        {busy ? "Lançando…" : "Lançar nota"}
      </Button>
    </form>
  );
}
