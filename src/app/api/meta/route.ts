import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { getMeta } from "@/server/meta";

export const GET = route(async () => {
  await requireUser();
  return NextResponse.json(await getMeta());
});
