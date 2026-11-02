
import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth";

import {
  getRecentAlerts,
  getAlertSeveritySummary,
  getAlertSourceSummary,
} from "@/server/mongo/alerts";

export const GET = route(async () => {
  await requireUser();

  const [alerts, severitySummary, sourceSummary] =
    await Promise.all([
      getRecentAlerts(),
      getAlertSeveritySummary(),
      getAlertSourceSummary(),
    ]);

  return NextResponse.json({
    alerts,
    totalAlerts: alerts.length,
    severitySummary,
    sourceSummary,
  });
});
