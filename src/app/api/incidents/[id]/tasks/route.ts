import { NextResponse } from "next/server";
import { parseId, route } from "@/lib/http";
import { CAN_WRITE, requireUser } from "@/lib/auth";
import { taskCreateSchema } from "@/lib/validation";
import { createTask } from "@/server/incidents";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(CAN_WRITE);
  const id = parseId((await params).id);
  return NextResponse.json(await createTask(user, id, taskCreateSchema.parse(await req.json())), { status: 201 });
});
