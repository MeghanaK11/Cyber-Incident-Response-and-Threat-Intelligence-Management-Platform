import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { ADMIN_ONLY, requireUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { refreshEmbeddings } from "@/server/embeddings";

const STATUS_SQL = `
  SELECT (SELECT count(*)::INT FROM incidents) AS incidents,
         (SELECT count(*)::INT FROM incident_embeddings WHERE NOT is_stale) AS embedded,
         (SELECT count(*)::INT FROM incident_embeddings WHERE is_stale) AS stale`;

export const GET = route(async () => {
  await requireUser(ADMIN_ONLY);
  return NextResponse.json(await queryOne(STATUS_SQL));
});

// Embed every incident that is missing a vector or has a stale one
export const POST = route(async () => {
  await requireUser(ADMIN_ONLY);
  const written = await refreshEmbeddings();
  return NextResponse.json({ written, ...(await queryOne(STATUS_SQL)) });
});
