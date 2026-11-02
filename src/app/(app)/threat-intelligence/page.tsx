
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type ThreatFeed = {
  _id: string;
  source: string;
  indicatorType: string;
  indicatorValue: string;
  category: string;
  confidence: number;
  description?: string;
  receivedAt: string;
};

type ThreatFeedsResponse = {
  feeds: ThreatFeed[];
  totalFeeds: number;
};

export default function ThreatIntelligencePage() {
  const [data, setData] = useState<ThreatFeedsResponse | null>(null);
  const [indicator, setIndicator] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadFeeds(searchValue = "") {
    setLoading(true);
    setError("");

    try {
      const query = searchValue.trim()
        ? `?indicator=${encodeURIComponent(searchValue.trim())}`
        : "";

      const result = await api<ThreatFeedsResponse>(
        `/api/threat-feeds${query}`
      );

      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load threat feeds.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFeeds();
  }, []);

  function handleSearch() {
    void loadFeeds(indicator);
  }

  function handleClear() {
    setIndicator("");
    void loadFeeds();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">
          Threat Intelligence
        </h1>
        <p className="mt-2 text-ink-3">
          Threat indicators collected and stored in MongoDB.
        </p>
      </div>

      <section className="border border-line rounded-lg p-5">
        <p className="text-sm text-ink-3">Total Threat Indicators</p>
        <p className="mt-2 text-3xl font-semibold">
          {data?.totalFeeds ?? 0}
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="section-title">Search Threat Indicators</h2>
          <p className="mt-1 text-sm text-ink-3">
            Search using an IP address, domain, URL, or hash.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <input
            value={indicator}
            onChange={(e) => setIndicator(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="Enter an indicator..."
            className="min-w-0 flex-1 rounded-lg border border-line bg-transparent px-4 py-2"
          />

          <button
            onClick={handleSearch}
            className="rounded-lg bg-ink px-5 py-2 text-white"
          >
            Search
          </button>

          <button
            onClick={handleClear}
            className="rounded-lg border border-line px-5 py-2"
          >
            Clear
          </button>
        </div>
      </section>

      {error && <p className="text-critical">{error}</p>}

      {loading ? (
        <p className="text-ink-3">Loading threat intelligence...</p>
      ) : (
        <section>
          <h2 className="section-title mb-4">Threat Intelligence Records</h2>

          {!data || data.feeds.length === 0 ? (
            <p className="text-ink-3">No threat intelligence records found.</p>
          ) : (
            <div className="overflow-x-auto border border-line rounded-lg">
              <table className="w-full text-left text-sm">
                <thead className="bg-panel-2 text-ink-2">
                  <tr>
                    <th className="p-3">Source</th>
                    <th className="p-3">Indicator Type</th>
                    <th className="p-3">Indicator Value</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Confidence</th>
                    <th className="p-3">Received At</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-line">
                  {data.feeds.map((feed) => (
                    <tr key={feed._id}>
                      <td className="p-3">{feed.source}</td>
                      <td className="p-3">{feed.indicatorType}</td>
                      <td className="p-3 font-medium">{feed.indicatorValue}</td>
                      <td className="p-3">{feed.category}</td>
                      <td className="p-3">{feed.confidence}%</td>
                      <td className="p-3 whitespace-nowrap">
                        {new Date(feed.receivedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
