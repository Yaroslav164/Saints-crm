/**
 * CSV reading. `lib/http.ts` already writes CSV, so the quoting rules live next to
 * each other by convention: this parser accepts exactly what `buildCsv` produces —
 * comma-separated, fields quoted only when they contain a comma, a quote or a line
 * break, quotes doubled inside a quoted field, CRLF line endings, UTF-8 BOM.
 *
 * A spreadsheet file is untrusted input of the worst kind (a whole table at once),
 * so the parser has no delimiters to guess, no auto-typing and no line-count policy:
 * it turns text into `string[][]` and every decision about what a cell means is made
 * by the caller, where it can be validated and reported per row.
 */

/** Quoted field, escape-by-doubling scanner. Keeps `\r\n`, `\n` and bare `\r` as row ends. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let rowStarted = false;

  const endField = () => {
    row.push(field);
    field = "";
  };

  const endRow = () => {
    endField();
    // A blank line is not a record; a line of `,,` is a record of three empty cells and
    // must still reach the validator, which will fail it with a message the user can act on.
    if (rowStarted && row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
    rowStarted = false;
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    // A quote only opens a quoted field at the start of one; mid-field it is data.
    if (char === '"' && field === "") {
      inQuotes = true;
      rowStarted = true;
      continue;
    }

    if (char === ",") {
      endField();
      rowStarted = true;
      continue;
    }

    if (char === "\r") {
      if (source[index + 1] === "\n") index += 1;
      endRow();
      continue;
    }

    if (char === "\n") {
      endRow();
      continue;
    }

    field += char;
    rowStarted = true;
  }

  if (rowStarted || field !== "" || row.length > 0) endRow();

  return rows;
}

/** Header cells are matched case- and punctuation-insensitively, so `offerId` variants collapse. */
export function normaliseHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Multi-value cells. The export writes GEOs and tags space-separated (a comma inside an
 * unquoted cell would break the row), so space is accepted first; comma and semicolon
 * are there for files typed by hand in a spreadsheet.
 */
export function splitMulti(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Money and counters as a spreadsheet writes them: `$1,200`, `1 200`, `1200.5`, and the
 * European `1.200,50`. Returns `null` when there is nothing to read, which the caller
 * treats as "leave the default" — an unparseable cell must never become a silent zero.
 */
export function parseAmount(value: string): number | null {
  const text = value.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(text)) return null;

  // The last separator decides: a one- or two-digit tail is cents, a three-digit tail (or
  // several separators before the last one) is a thousands group. Both `1,200` and `1.200`
  // therefore read as twelve hundred — the app's own export writes bare numbers, so this
  // rule only ever fires on files typed or re-saved by hand.
  const last = Math.max(text.lastIndexOf(","), text.lastIndexOf("."));
  const tail = last === -1 ? "" : text.slice(last + 1);
  const isDecimal = tail.length > 0 && tail.length <= 2;

  const digits = isDecimal ? `${text.slice(0, last).replace(/[.,]/g, "")}.${tail}` : text.replace(/[.,]/g, "");
  const number = Number.parseFloat(digits);

  return Number.isFinite(number) ? number : null;
}
