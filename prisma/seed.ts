import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const SECTORS = [
  { name: "Faturamento", costCenter: "1.01.001" },
  { name: "Compras", costCenter: "1.01.002" },
  { name: "UTI Adulto", costCenter: "3.01.001" },
  { name: "Centro Cirúrgico", costCenter: "3.02.001" },
  { name: "Farmácia", costCenter: "3.03.001" },
  { name: "Laboratório", costCenter: "3.04.001" },
];

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Defina ${name} no .env para rodar o seed.`);
  return v;
}

async function ensureUser(data: {
  email: string;
  name: string;
  password: string;
  role: "ADMIN" | "FINANCEIRO" | "REQUESTER";
  sectorId: string;
}) {
  const email = data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  // Não sobrescreve senha/perfil de conta já existente ao rodar o seed de novo.
  if (existing) return { user: existing, created: false };
  const user = await db.user.create({
    data: {
      email,
      name: data.name,
      role: data.role,
      sectorId: data.sectorId,
      passwordHash: await bcrypt.hash(data.password, 12),
      mustChangePassword: true,
    },
  });
  return { user, created: true };
}

async function main() {
  const sectors = new Map<string, string>();
  for (const s of SECTORS) {
    const sector = await db.sector.upsert({ where: { costCenter: s.costCenter }, update: {}, create: s });
    sectors.set(s.name, sector.id);
  }

  const admin = await ensureUser({
    email: required("SEED_ADMIN_EMAIL"),
    name: "Administrador de TI",
    password: required("SEED_ADMIN_PASSWORD"),
    role: "ADMIN",
    sectorId: sectors.get("Faturamento")!,
  });
  const financeiro = await ensureUser({
    email: required("SEED_FINANCEIRO_EMAIL"),
    name: "Coordenadora Financeira",
    password: required("SEED_FINANCEIRO_PASSWORD"),
    role: "FINANCEIRO",
    sectorId: sectors.get("Faturamento")!,
  });
  const chefia = await ensureUser({
    email: required("SEED_REQUESTER_EMAIL"),
    name: "Chefia UTI Adulto",
    password: required("SEED_REQUESTER_PASSWORD"),
    role: "REQUESTER",
    sectorId: sectors.get("UTI Adulto")!,
  });

  console.log(`Setores: ${sectors.size}`);
  for (const { user, created } of [admin, financeiro, chefia]) {
    console.log(`${created ? "Criado" : "Já existia"}: ${user.email} (${user.role})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
