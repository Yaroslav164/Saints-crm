import { connection } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { ApiError, conflict, readJson, toResponse } from "@/lib/http";
import { fieldErrors, registerSchema } from "@/lib/validations";

export async function POST(request: Request) {
  await connection();

  return toResponse(async () => {
    const parsed = registerSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new ApiError(422, "Validation failed", fieldErrors(parsed.error));
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw conflict("Email is already registered", { email: "Already registered" });

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: { email, name: parsed.data.name, passwordHash, role: "USER" },
      select: { id: true, email: true, name: true, role: true },
    });

    return user;
  });
}
