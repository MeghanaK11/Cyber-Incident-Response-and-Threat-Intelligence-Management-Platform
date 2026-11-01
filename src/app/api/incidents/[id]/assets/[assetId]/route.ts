import { NextResponse } from "next/server";
import { parseId, route } from "@/lib/http";
import { CAN_WRITE, requireUser } from "@/lib/auth";
import { removeIncidentAsset } from "@/server/incidents";

type Ctx = { params: Promise<{ id: string; assetId: string }> };

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser(CAN_WRITE);
  const p = await params;
  await removeIncidentAsset(user, parseId(p.id), parseId(p.assetId, "asset id"));
  return NextResponse.json({ ok: true });
});
