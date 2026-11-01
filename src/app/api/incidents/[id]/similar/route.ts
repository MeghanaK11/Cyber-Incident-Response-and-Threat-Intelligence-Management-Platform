import { NextResponse } from "next/server";
import { parseId, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { similarIncidents } from "@/server/embeddings";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  await requireUser();
  return NextResponse.json({ items: await similarIncidents(parseId((await params).id)) });
});
