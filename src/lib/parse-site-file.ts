import { deriveMonitorNameFromUrl } from "@/lib/derive-monitor-name";

export type ParsedSiteRow = { name: string; url: string };

const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Split one CSV line into fields (supports quoted commas). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function looksLikeUrl(cell: string): boolean {
  return /^https?:\/\//i.test(cell.trim());
}

function normalizeRows(matrix: string[][]): ParsedSiteRow[] {
  if (matrix.length === 0) return [];

  const first = matrix[0].map((c) => c.trim());
  const lower = first.map((c) => c.toLowerCase());
  const urlCol = lower.findIndex(
    (c) =>
      c === "url" ||
      c === "link" ||
      c === "website" ||
      c === "address" ||
      c === "endpoint"
  );
  const nameCol = lower.findIndex(
    (c) => c === "name" || c === "title" || c === "label" || c === "site"
  );

  let start = 0;
  let urlIdx: number;
  let nameIdx: number | null;

  if (urlCol >= 0) {
    start = 1;
    urlIdx = urlCol;
    nameIdx = nameCol >= 0 ? nameCol : null;
  } else if (first.length === 1) {
    urlIdx = 0;
    nameIdx = null;
  } else if (first.length >= 2) {
    const c0 = first[0] ?? "";
    const c1 = first[1] ?? "";
    if (looksLikeUrl(c0)) {
      urlIdx = 0;
      nameIdx = 1;
    } else if (looksLikeUrl(c1)) {
      urlIdx = 1;
      nameIdx = 0;
    } else {
      urlIdx = 1;
      nameIdx = 0;
    }
  } else {
    return [];
  }

  const result: ParsedSiteRow[] = [];
  for (let r = start; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || row.every((c) => !String(c).trim())) continue;
    const url = String(row[urlIdx] ?? "").trim();
    if (!url || url.startsWith("#")) continue;
    let name = "";
    if (nameIdx !== null && row[nameIdx] != null) {
      name = String(row[nameIdx]).trim();
    }
    if (!name) {
      name = deriveMonitorNameFromUrl(url);
    }
    result.push({ name, url });
  }
  return result;
}

/** Parse newline-separated URLs (optional # comments). */
export function parseSitesFromPlainText(text: string): ParsedSiteRow[] {
  const lines = text.split(/\r?\n/);
  const result: ParsedSiteRow[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    result.push({ name: deriveMonitorNameFromUrl(t), url: t });
  }
  return result;
}

/** Parse CSV string into site rows. */
export function parseSitesFromCsvString(text: string): ParsedSiteRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const matrix = lines.map((line) => splitCsvLine(line));
  return normalizeRows(matrix);
}

export async function parseSitesFromXlsxArrayBuffer(
  buffer: ArrayBuffer
): Promise<ParsedSiteRow[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];
  const asStrings = matrix.map((row) =>
    (row ?? []).map((c) => (c == null ? "" : String(c)))
  );
  return normalizeRows(asStrings);
}

/** Browser: parse .txt / .csv / .xlsx from a File. */
export async function parseSitesFromFile(file: File): Promise<ParsedSiteRow[]> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`File must be at most ${MAX_FILE_BYTES / 1024 / 1024} MB`);
  }
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return await parseSitesFromXlsxArrayBuffer(buf);
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  if (name.endsWith(".csv")) {
    return parseSitesFromCsvString(text);
  }
  if (name.endsWith(".txt")) {
    return parseSitesFromPlainText(text);
  }

  if (text.trim().startsWith("PK")) {
    return await parseSitesFromXlsxArrayBuffer(buf);
  }

  const firstLine = text.split(/\r?\n/)[0] ?? "";
  if (firstLine.includes(",") && splitCsvLine(firstLine).length >= 2) {
    return parseSitesFromCsvString(text);
  }
  return parseSitesFromPlainText(text);
}
