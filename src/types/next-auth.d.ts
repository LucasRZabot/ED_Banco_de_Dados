import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/lib/roles";

declare module "next-auth" {
  interface User {
    role?: AppRole;
    sessionVersion?: number;
  }

  interface Session {
    user: { id: string; role?: AppRole; sessionVersion?: number } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role?: AppRole;
    sessionVersion?: number;
  }
}
