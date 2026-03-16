import { NextResponse } from "next/server";
import { fetchChildAccounts } from "@/lib/google-ads";

export async function GET() {
  try {
    const accounts = await fetchChildAccounts();
    return NextResponse.json({ accounts });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
