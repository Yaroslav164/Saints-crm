import { Prisma } from "@/lib/generated/prisma/client";
import { ZodError } from "zod";
import { fieldErrors } from "@/lib/validations";

/** An error whose status and field map are meant to reach the HTTP client. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const unauthorized = (message = "Sign in required") => new ApiError(401, message);
export const forbidden = (message = "Not allowed") => new ApiError(403, message);
export const notFound = (message = "Not found") => new ApiError(404, message);
export const conflict = (message = "Already exists", fields?: Record<string, string>) =>
  new ApiError(409, message, fields);

/**
 * Maps a thrown value to the `{ error: { message, fields } }` envelope. Split out
 * of `toResponse` because the CSV route returns a non-JSON body and therefore
 * cannot use the wrapper, but must answer errors identically.
 */
export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: { message: error.message, fields: error.fields } }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return Response.json(
      { error: { message: "Validation failed", fields: fieldErrors(error) } },
      { status: 422 },
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined)?.join(", ") ?? "value";
      return Response.json({ error: { message: `${target} must be unique` } }, { status: 409 });
    }
    if (error.code === "P2003" || error.code === "P2014") {
      return Response.json({ error: { message: "Related record is still in use" } }, { status: 400 });
    }
    if (error.code === "P2025") {
      return Response.json({ error: { message: "Record not found" } }, { status: 404 });
    }
  }
  console.error("[api]", error);
  return Response.json({ error: { message: "Something went wrong" } }, { status: 500 });
}

/**
 * Single exit point for every route handler: wraps the payload in `{ data }`,
 * turns thrown errors into `{ error: { message, fields } }` and keeps Prisma
 * specifics (unique/FK/not-found) out of the client.
 */
export async function toResponse<T>(action: () => Promise<T>): Promise<Response> {
  try {
    return Response.json({ data: await action() });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Parses a JSON body once and keeps the message human-readable on bad input. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Body must be valid JSON");
  }
}

export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
