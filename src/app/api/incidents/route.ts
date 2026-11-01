import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { CAN_WRITE, requireUser } from "@/lib/auth";
import { incidentCreateSchema, incidentListSchema } from "@/lib/validation";
import { createIncident, listIncidents } from "@/server/incidents";
import { refreshInBackground } from "@/server/embeddings";

export const GET = route(async (req) => {
  const user = await requireUser();
  const raw = Object.fromEntries(new URL(req.url).searchParams);
  // drop empty strings so blank filters are ignored
  const params = incidentListSchema.parse(Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== "")));
  return NextResponse.json(await listIncidents(params, user));
});

export const POST = route(async (req) => {
  const user = await requireUser(CAN_WRITE);
  const input = incidentCreateSchema.parse(await req.json());
  const created = await createIncident(user, input);
  refreshInBackground([created.incident_id]);
  return NextResponse.json(created, { status: 201 });
});
