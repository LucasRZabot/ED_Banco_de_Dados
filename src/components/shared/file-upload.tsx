"use client";

import { useState } from "react";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/format";
import { uploadFile, type UploadedFile } from "@/lib/upload-client";
import type { AttachmentCategoryKey } from "@/lib/storage-keys";

export function FileUpload({
  name = "uploadTokens",
  category,
  accept = "application/pdf,image/png,image/jpeg",
  multiple = true,
  referenceDate,
  onBusyChange,
}: {
  name?: string;
  category: AttachmentCategoryKey;
  accept?: string;
  multiple?: boolean;
  /** YYYY-MM-DD: mês do vencimento/emissão na key do S3. */
  referenceDate?: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const list = event.target.files;
    if (!list?.length) return;
    setPending(true);
    onBusyChange?.(true);
    setError(undefined);
    try {
      const uploaded: UploadedFile[] = [];
      for (const file of Array.from(list)) {
        uploaded.push(await uploadFile(file, category, referenceDate));
      }
      setFiles((current) => (multiple ? [...current, ...uploaded] : uploaded));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no envio.");
    } finally {
      setPending(false);
      onBusyChange?.(false);
      event.target.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="file" accept={accept} multiple={multiple} className="sr-only" onChange={onChange} disabled={pending} />
        <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-2.5 text-sm hover:bg-muted">
          <Paperclip className="size-4" />
          {pending ? "Enviando…" : "Anexar arquivo"}
        </span>
      </label>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {files.map((file) => (
        <div key={file.fileKey} className="flex items-center gap-2 text-sm">
          <input type="hidden" name={name} value={file.uploadToken} />
          <Paperclip className="size-3.5 text-muted-foreground" />
          <span className="truncate">{file.fileName}</span>
          <span className="text-xs text-muted-foreground">{formatFileSize(file.fileSize)}</span>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={`Remover ${file.fileName}`}
            onClick={() => setFiles((current) => current.filter((f) => f.fileKey !== file.fileKey))}
          >
            <X />
          </Button>
        </div>
      ))}
    </div>
  );
}
