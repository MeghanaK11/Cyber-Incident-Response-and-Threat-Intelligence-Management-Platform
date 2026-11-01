import { NextResponse } from "next/server";
import { parseId, route } from "@/lib/http";
import { ADMIN_ONLY, CAN_WRITE, requireUser } from "@/lib/auth";
import { incidentUpdateSchema } from "@/lib/validation";
import { deleteIncident, getIncident, updateIncident } from "@/server/incidents";
import { refreshInBackground } from "@/server/embeddings";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  await requireUser();
  return NextResponse.json(await getIncident(parseId((await params).id)));
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(CAN_WRITE);
  const id = parseId((await params).id);
  const result = await updateIncident(user, id, incidentUpdateSchema.parse(await req.json()));
  refreshInBackground([id]); // no-op unless the text changed (trigger marks it stale)
  return NextResponse.json(result);
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser(ADMIN_ONLY);
  await deleteIncident(user, parseId((await params).id));
  return NextResponse.json({ ok: true });
});
