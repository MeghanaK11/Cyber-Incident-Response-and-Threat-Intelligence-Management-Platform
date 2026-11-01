import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth";

export const GET = route(async () => NextResponse.json({ user: await requireUser() }));
