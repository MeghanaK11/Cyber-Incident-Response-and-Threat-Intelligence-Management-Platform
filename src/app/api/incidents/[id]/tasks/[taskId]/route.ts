import { NextResponse } from "next/server";
import { parseId, route } from "@/lib/http";
import { CAN_WRITE, requireUser } from "@/lib/auth";
import { taskUpdateSchema } from "@/lib/validation";
import { updateTask } from "@/server/incidents";

type Ctx = { params: Promise<{ id: string; taskId: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(CAN_WRITE);
  const p = await params;
  const input = taskUpdateSchema.parse(await req.json());
  return NextResponse.json(await updateTask(user, parseId(p.id), parseId(p.taskId, "task id"), input));
});
