import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { homePathFor } from "@/lib/roles";

// Normalmente o proxy já redireciona "/"; aqui cobre o caso de o papel ter mudado desde o login.
export default async function HomePage() {
  const user = await requireUser();
  redirect(homePathFor(user.role));
}
