import { canViewAttachment } from "@/lib/attachments";
import { getFileBlob } from "@/lib/blobs";
import { fileDownloadHeaders } from "@/lib/content-disposition";
import { authenticateRequest } from "@/lib/dal";
import { isSafeFileKey } from "@/lib/upload-guard";

export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { user, error } = await authenticateRequest();
  if (error) return error;

  const { id } = await ctx.params;
  const { attachment, allowed } = await canViewAttachment(user, id);
  // 404 também quando não há permissão, para não confirmar a existência do arquivo.
  if (!attachment || !allowed) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });

  if (!isSafeFileKey(attachment.fileKey, attachment.category)) {
    return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }
  const blob = await getFileBlob(attachment.fileKey);
  if (!blob) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(blob.data), {
    status: 200,
    headers: fileDownloadHeaders({
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      download,
    }),
  });
}
