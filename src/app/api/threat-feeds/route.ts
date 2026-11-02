import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth";

import {
  getRecentThreatFeeds,
  searchThreatFeeds,
} from "@/server/mongo/threatFeeds";

export const GET = route(async (request) => {
  await requireUser();

  const { searchParams } = new URL(request.url);
  const indicator = searchParams.get("indicator");

  const feeds = indicator
    ? await searchThreatFeeds(indicator)
    : await getRecentThreatFeeds();

  return NextResponse.json({
    feeds,
    totalFeeds: feeds.length,
  });
});