"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

export type Meta = {
  severities: string[];
  statuses: string[];
  categories: string[];
  roles: { role_id: number; role_name: string; description: string }[];
  assignees: { user_id: number; full_name: string; role: string }[];
  assets: { asset_id: number; hostname: string; ip_address: string | null; asset_type: string; department: string; criticality: number }[];
  sla: { severity: string; respond_minutes: number; resolve_minutes: number }[];
};

// Cached for the page session; dropdown values rarely change while a page is open
let cache: Promise<Meta> | null = null;

export function useMeta(refresh = false): Meta | null {
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    if (refresh || !cache) cache = api<Meta>("/api/meta");
    cache.then(setMeta).catch(() => { cache = null; });
  }, [refresh]);
  return meta;
}
