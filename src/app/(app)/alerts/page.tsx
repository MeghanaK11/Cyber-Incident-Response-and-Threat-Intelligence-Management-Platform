
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type Alert = {
  _id: string;
  source: string;
  alertType: string;
  severity: string;
  message: string;
  payload: Record<string, unknown>;
  receivedAt: string;
};

type AlertsResponse = {
  alerts: Alert[];
  totalAlerts: number;
  severitySummary: { severity: string; count: number }[];
  sourceSummary: { source: string; count: number }[];
};

export default function AlertsPage() {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<AlertsResponse>("/api/alerts")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <p className="text-critical">{error}</p>;
  }

  if (!data) {
    return <p className="text-ink-3">Loading security alerts...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">
          Security Alerts
        </h1>
        <p className="mt-2 text-ink-3">
          Security alerts collected and stored in MongoDB.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="border border-line rounded-lg p-5">
          <p className="text-sm text-ink-3">Total Alerts</p>
          <p className="mt-2 text-3xl font-semibold">
            {data.totalAlerts}
          </p>
        </div>

        <div className="border border-line rounded-lg p-5">
          <p className="text-sm text-ink-3">Severity Categories</p>
          <div className="mt-2 space-y-1">
            {data.severitySummary.map((item) => (
              <p key={item.severity}>
                {item.severity}: {item.count}
              </p>
            ))}
          </div>
        </div>

        <div className="border border-line rounded-lg p-5">
          <p className="text-sm text-ink-3">Alert Sources</p>
          <div className="mt-2 space-y-1">
            {data.sourceSummary.map((item) => (
              <p key={item.source}>
                {item.source}: {item.count}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title mb-4">Recent Security Alerts</h2>

        {data.alerts.length === 0 ? (
          <p className="text-ink-3">No security alerts found.</p>
        ) : (
          <div className="overflow-x-auto border border-line rounded-lg">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel-2 text-ink-2">
                <tr>
                  <th className="p-3">Source</th>
                  <th className="p-3">Alert Type</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Message</th>
                  <th className="p-3">Received At</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {data.alerts.map((alert) => (
                  <tr key={alert._id}>
                    <td className="p-3">{alert.source}</td>
                    <td className="p-3">{alert.alertType}</td>
                    <td className="p-3 font-semibold">
                      {alert.severity}
                    </td>
                    <td className="p-3">{alert.message}</td>
                    <td className="p-3 whitespace-nowrap">
                      {new Date(alert.receivedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
