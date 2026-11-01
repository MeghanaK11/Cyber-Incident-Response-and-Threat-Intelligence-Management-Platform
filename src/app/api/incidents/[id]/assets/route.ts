import { NextResponse } from "next/server";
import { parseId, route } from "@/lib/http";
import { CAN_WRITE, requireUser } from "@/lib/auth";
import { incidentAssetSchema } from "@/lib/validation";
import { addIncidentAsset } from "@/server/incidents";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(CAN_WRITE);
  const id = parseId((await params).id);
  const { asset_id, impact } = incidentAssetSchema.parse(await req.json());
  await addIncidentAsset(user, id, asset_id, impact);
  return NextResponse.json({ ok: true }, { status: 201 });
});
