import { NextResponse } from "next/server";
import { HttpError, parseId, route } from "@/lib/http";
import { CAN_WRITE, requireUser } from "@/lib/auth";
import { assignSchema } from "@/lib/validation";
import { assignIncident } from "@/server/incidents";

type Ctx = { params: Promise<{ id: string }> };

// Analysts may take an incident themselves or ask for auto-assignment.
// Only admins can hand an incident to a specific other person.
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(CAN_WRITE);
  const id = parseId((await params).id);
  const { assignee_id } = assignSchema.parse(await req.json());
  if (user.role !== "ADMIN" && assignee_id !== null && assignee_id !== user.user_id) {
    throw new HttpError(403, "Analysts can only assign incidents to themselves");
  }
  return NextResponse.json(await assignIncident(user, id, assignee_id));
});
