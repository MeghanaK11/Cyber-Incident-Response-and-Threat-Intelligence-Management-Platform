import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { ADMIN_ONLY, requireUser } from "@/lib/auth";
import { userCreateSchema } from "@/lib/validation";
import { createUser, listUsers } from "@/server/users";

export const GET = route(async () => {
  await requireUser(ADMIN_ONLY);
  return NextResponse.json({ items: await listUsers() });
});

export const POST = route(async (req) => {
  const actor = await requireUser(ADMIN_ONLY);
  const input = userCreateSchema.parse(await req.json());
  return NextResponse.json(await createUser(actor, input), { status: 201 });
});
