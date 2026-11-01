import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { ADMIN_ONLY, requireUser } from "@/lib/auth";
import { assetCreateSchema } from "@/lib/validation";
import { createAsset, listAssets } from "@/server/assets";

export const GET = route(async () => {
  await requireUser();
  return NextResponse.json({ items: await listAssets() });
});

export const POST = route(async (req) => {
  const user = await requireUser(ADMIN_ONLY);
  return NextResponse.json(await createAsset(user, assetCreateSchema.parse(await req.json())), { status: 201 });
});
