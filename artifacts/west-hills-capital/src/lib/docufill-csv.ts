type CsvField = {
  id: string;
  name: string;
  source?: string;
  defaultValue?: string;
  interviewMode?: string;
  interviewVisible?: boolean;
};

type CsvSession = {
  package_id?: number | string;
  package_name: string;
  fields: CsvField[];
  answers: Record<string, string>;
  prefill?: Record<string, string>;
};

function fieldInInterview(field: CsvField): boolean {
  if (field.interviewMode) return field.interviewMode !== "omitted";
  return field.interviewVisible !== false;
}

function fieldValue(field: CsvField, answers: Record<string, string>, prefill: Record<string, string> | undefined): string {
  return String(
    answers[field.id]
    ?? (field.source ? prefill?.[field.source] : undefined)
    ?? prefill?.[field.name]
    ?? field.defaultValue
    ?? "",
  );
}

function csvQuote(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function sessionToCsv(session: CsvSession): string {
  const fields = session.fields.filter(fieldInInterview);
  const headers = ["__package_id__", "__package_name__", ...fields.map((f) => f.name)];
  const values = [
    String(session.package_id ?? ""),
    session.package_name,
    ...fields.map((f) => fieldValue(f, session.answers, session.prefill)),
  ];
  return [
    headers.map(csvQuote).join(","),
    values.map(csvQuote).join(","),
  ].join("\n");
}

export function packageTemplateToCsv(packageId: number | string, packageName: string, fields: CsvField[]): string {
  const visibleFields = fields.filter(fieldInInterview);
  const headers = ["__package_id__", "__package_name__", ...visibleFields.map((f) => f.name)];
  return headers.map(csvQuote).join(",") + "\n";
}

export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseCsvString(csv: string): { headers: string[]; rows: Record<string, string>[] } {
  const records = parseCsvDocument(csv);
  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0];
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < records.length; i++) {
    const values = records[i];
    if (values.length === 0 || (values.length === 1 && values[0] === "")) continue;
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

function parseCsvDocument(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let i = 0;
  const len = csv.length;

  while (i < len) {
    const ch = csv[i];

    if (ch === '"') {
      i++;
      while (i < len) {
        if (csv[i] === '"') {
          if (i + 1 < len && csv[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += csv[i];
          i++;
        }
      }
      if (i < len && csv[i] !== "," && csv[i] !== "\r" && csv[i] !== "\n") {
        i++;
      }
    } else if (ch === ",") {
      record.push(field);
      field = "";
      i++;
    } else if (ch === "\r" || ch === "\n") {
      record.push(field);
      field = "";
      records.push(record);
      record = [];
      if (ch === "\r" && i + 1 < len && csv[i + 1] === "\n") {
        i++;
      }
      i++;
    } else {
      field += ch;
      i++;
    }
  }

  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records;
}
