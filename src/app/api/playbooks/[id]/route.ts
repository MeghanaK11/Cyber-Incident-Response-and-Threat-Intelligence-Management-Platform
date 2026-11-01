import { NextResponse } from "next/server";
import { parseId, route } from "@/lib/http";
import { ADMIN_ONLY, requireUser } from "@/lib/auth";
import { playbookUpdateSchema } from "@/lib/validation";
import { deletePlaybook, getPlaybook, updatePlaybook } from "@/server/playbooks";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  await requireUser();
  return NextResponse.json(await getPlaybook(parseId((await params).id)));
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(ADMIN_ONLY);
  await updatePlaybook(user, parseId((await params).id), playbookUpdateSchema.parse(await req.json()));
  return NextResponse.json({ ok: true });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser(ADMIN_ONLY);
  await deletePlaybook(user, parseId((await params).id));
  return NextResponse.json({ ok: true });
});
