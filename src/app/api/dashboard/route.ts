import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/server/dashboard";

export const GET = route(async () => {
  await requireUser();
  return NextResponse.json(await getDashboard());
});
