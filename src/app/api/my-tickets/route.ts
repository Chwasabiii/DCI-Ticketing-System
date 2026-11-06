import { NextResponse } from "next/server";
import { getCurrentContext, getTickets } from "@/lib/data";

export async function GET() {
  const { profile } = await getCurrentContext();
  if (!profile || profile.status !== "active") {
    return NextResponse.json({ error: "Sign in to view tickets." }, { status: 401 });
  }
  try {
    const tickets = await getTickets(100);
    return NextResponse.json({ tickets }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not refresh tickets." }, { status: 503 });
  }
}
