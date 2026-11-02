import { connection } from "next/server";
import { IMPORT_MAX_BYTES, IMPORT_MAX_LABEL, importBundles } from "@/lib/import";
import { requireApiUser } from "@/lib/dal";
import { ApiError, readJson, toResponse } from "@/lib/http";
import { fieldErrors, importJsonSchema } from "@/lib/validations";

/**
 * FormData booleans: a form field is always a string, and an absent one means the default
 * (the dialog sends both flags explicitly, so absence only happens for a hand-made request).
 */
function flag(value: FormDataEntryValue | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  const text = String(value).toLowerCase();
  return text === "true" || text === "1" || text === "on";
}

/**
 * Reads a CSV of bundles. Two bodies are accepted because the two callers are different:
 * a browser uploads the file as `multipart/form-data` (so the bytes never sit in a JSON
 * string), while the smoke test and any script post `{ text }` as JSON.
 *
 * Defaults to a dry run: `dryRun` is true unless the caller says otherwise, so a request
 * that forgot the flag reports what it would do instead of writing rows nobody asked for.
 */
export async function POST(request: Request) {
  await connection();

  return toResponse(async () => {
    const user = await requireApiUser();
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData().catch(() => null);
      if (!form) throw new ApiError(400, "Body must be a multipart form");

      const file = form.get("file");
      if (!(file instanceof File)) throw new ApiError(422, "Upload the CSV in the `file` field", { file: "Missing" });
      if (file.size > IMPORT_MAX_BYTES) {
        throw new ApiError(413, `At most ${IMPORT_MAX_LABEL} per file`, { file: "Too large" });
      }

      const text = await file.text();
      return importBundles(user, {
        text,
        dryRun: flag(form.get("dryRun"), true),
        skipInvalid: flag(form.get("skipInvalid"), true),
      });
    }

    const parsed = importJsonSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "Validation failed", fieldErrors(parsed.error));

    return importBundles(user, parsed.data);
  });
}
