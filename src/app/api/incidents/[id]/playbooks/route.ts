import { NextResponse } from "next/server";
import { parseId, route } from "@/lib/http";
import { CAN_WRITE, requireUser } from "@/lib/auth";
import { applyPlaybookSchema } from "@/lib/validation";
import { applyPlaybook } from "@/server/incidents";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(CAN_WRITE);
  const id = parseId((await params).id);
  const { playbook_id } = applyPlaybookSchema.parse(await req.json());
  return NextResponse.json(await applyPlaybook(user, id, playbook_id), { status: 201 });
});
