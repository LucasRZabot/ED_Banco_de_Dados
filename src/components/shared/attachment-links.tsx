import { ExternalLink } from "lucide-react";
import { formatFileSize } from "@/lib/format";

export function AttachmentLinks({
  items,
  empty = "Nenhum.",
}: {
  items: { id: string; fileName: string; fileSize: number }[];
  empty?: string;
}) {
  if (!items.length) return <p className="text-muted-foreground">{empty}</p>;
  return (
    <ul className="grid gap-2">
      {items.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
          <a
            href={`/api/files/${a.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" />
            {a.fileName}
          </a>
          <span className="text-muted-foreground">({formatFileSize(a.fileSize)})</span>
          <a href={`/api/files/${a.id}?download=1`} className="text-xs text-muted-foreground hover:underline">
            Baixar
          </a>
        </li>
      ))}
    </ul>
  );
}
