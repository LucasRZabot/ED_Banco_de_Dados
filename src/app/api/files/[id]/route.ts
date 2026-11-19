import { canViewAttachment } from "@/lib/attachments";
import { authenticateRequest } from "@/lib/dal";
import { presignDownload } from "@/lib/s3";

export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { user, error } = await authenticateRequest();
  if (error) return error;

  const { id } = await ctx.params;
  const { attachment, allowed } = await canViewAttachment(user, id);
  // 404 também quando não há permissão, para não confirmar a existência do arquivo.
  if (!attachment || !allowed) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const url = await presignDownload(attachment.fileKey, attachment.fileName, attachment.fileType, {
    disposition: download ? "attachment" : "inline",
  });
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "private, no-store" },
  });
}
