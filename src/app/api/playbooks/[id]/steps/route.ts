import { NextResponse } from "next/server";
import { parseId, route } from "@/lib/http";
import { ADMIN_ONLY, requireUser } from "@/lib/auth";
import { playbookStepsSchema } from "@/lib/validation";
import { replaceSteps } from "@/server/playbooks";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(ADMIN_ONLY);
  const { steps } = playbookStepsSchema.parse(await req.json());
  await replaceSteps(user, parseId((await params).id), steps);
  return NextResponse.json({ ok: true });
});
