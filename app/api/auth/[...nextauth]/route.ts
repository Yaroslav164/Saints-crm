import { connection } from "next/server";
import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

// Auth.js reads the session cookie through its own request handling, which Next
// does not see as a request-time API. Without `connection()` the GET handler is
// prerendered at build time — and in a Docker build the database is not there.
async function handle(request: NextRequest, method: "GET" | "POST") {
  await connection();
  return method === "GET" ? handlers.GET(request) : handlers.POST(request);
}

export async function GET(request: NextRequest) {
  return handle(request, "GET");
}

export async function POST(request: NextRequest) {
  return handle(request, "POST");
}
