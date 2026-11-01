import { NextResponse } from "next/server";
import { parseId, route } from "@/lib/http";
import { ADMIN_ONLY, requireUser } from "@/lib/auth";
import { assetUpdateSchema } from "@/lib/validation";
import { deleteAsset, updateAsset } from "@/server/assets";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(ADMIN_ONLY);
  await updateAsset(user, parseId((await params).id), assetUpdateSchema.parse(await req.json()));
  return NextResponse.json({ ok: true });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser(ADMIN_ONLY);
  await deleteAsset(user, parseId((await params).id));
  return NextResponse.json({ ok: true });
});
