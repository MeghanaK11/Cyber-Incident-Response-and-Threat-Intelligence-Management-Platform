import { NextResponse } from "next/server";
import { parseId, route } from "@/lib/http";
import { ADMIN_ONLY, requireUser } from "@/lib/auth";
import { userUpdateSchema } from "@/lib/validation";
import { updateUser } from "@/server/users";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const actor = await requireUser(ADMIN_ONLY);
  const id = parseId((await params).id);
  await updateUser(actor, id, userUpdateSchema.parse(await req.json()));
  return NextResponse.json({ ok: true });
});
