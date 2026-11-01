import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { ADMIN_ONLY, requireUser } from "@/lib/auth";
import { playbookCreateSchema } from "@/lib/validation";
import { createPlaybook, listPlaybooks } from "@/server/playbooks";

export const GET = route(async () => {
  await requireUser();
  return NextResponse.json({ items: await listPlaybooks() });
});

export const POST = route(async (req) => {
  const user = await requireUser(ADMIN_ONLY);
  return NextResponse.json(await createPlaybook(user, playbookCreateSchema.parse(await req.json())), { status: 201 });
});
