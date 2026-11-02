import { connection } from "next/server";
import { importTemplate } from "@/lib/import";
import { requireApiUser } from "@/lib/dal";
import { buildCsv, csvResponse, errorResponse } from "@/lib/http";

/**
 * The header line plus one example row, so a file can be started in a spreadsheet instead
 * of being guessed from an error message. Served rather than shipped in `public/` because
 * the column list lives in `lib/import.ts` — a static file would be a second copy of it,
 * and the two would disagree the moment a column is added.
 */
export async function GET() {
  await connection();

  try {
    await requireApiUser();
    const { headers, example } = importTemplate();
    return csvResponse("bundles-import-template.csv", buildCsv(headers, [example]));
  } catch (error) {
    return errorResponse(error);
  }
}
