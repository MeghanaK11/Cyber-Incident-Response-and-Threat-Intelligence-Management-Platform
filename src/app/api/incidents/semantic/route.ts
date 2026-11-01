import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { semanticSearch } from "@/server/embeddings";

const schema = z.object({ q: z.string().trim().min(3, "Describe what you are looking for").max(500) });

export const GET = route(async (req) => {
  await requireUser();
  const { q } = schema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json({ items: await semanticSearch(q, 10) });
});
