import * as XLSX from "xlsx";

export interface ShipmentRow {
  id: string;
  containerNo: string;
  method: "LTL" | "LOCAL";
  shipId: string;
  ctns: number;
  cbm: number;
  fbaCode: string;
  address: string;
  description: string;
  notes: string;
}

export interface DispatchRecord {
  id: string;
  containerNo: string;
  method: "LTL" | "LOCAL";
  destination: string;
  address: string;
  cartons: number;
  pallets: number;
  shipIds: string[];
  aiHint: string;
  // 调度员填写的字段
  pickupDate: string;
  truckCompany: string;
  costPrice: string;
  totalQuote: string;
  proNumber: string;
  status: "pending" | "scheduled" | "in_transit" | "delivered";
}

function findContainerNo(sheet: XLSX.WorkSheet): string | null {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:Z10");
  for (let r = 0; r <= Math.min(range.e.r, 4); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === "string") {
        const match = cell.v.match(/[A-Z]{4}\d{7}/);
        if (match) return match[0];
      }
    }
  }
  return null;
}

function findHeaderRow(
  data: (string | number | null)[][]
): number {
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i];
    if (!row) continue;
    const joined = row.map((c) => String(c || "").toUpperCase()).join(" ");
    if (joined.includes("METHOD") || joined.includes("渠道")) {
      return i;
    }
  }
  return -1;
}

function getColIndex(
  headerRow: (string | number | null)[],
  ...keywords: string[]
): number {
  for (let i = 0; i < headerRow.length; i++) {
    const val = String(headerRow[i] || "").toUpperCase().trim();
    if (keywords.some((k) => val.includes(k))) return i;
  }
  return -1;
}

function analyzeNotes(notes: string, address: string): string {
  const combined = `${notes} ${address}`;
  const lower = combined.toLowerCase();
  const hints: string[] = [];

  // 邮件预约
  const emailMatch = combined.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  );
  if (emailMatch) {
    hints.push(`需邮件预约 (${emailMatch[0]})`);
  }

  // lift gate
  if (lower.includes("lift gate") || lower.includes("liftgate")) {
    hints.push("需要 Lift Gate");
  }

  // 不用预约
  if (
    combined.includes("不用预约") ||
    combined.includes("无需预约") ||
    lower.includes("no appointment")
  ) {
    hints.push("无需预约");
  }

  // 需要预约
  if (
    combined.includes("预约") &&
    !combined.includes("不用预约") &&
    !combined.includes("无需预约")
  ) {
    hints.push("需预约派送");
  }

  // 电话预约
  if (
    combined.includes("电话预约") ||
    combined.includes("送货前电话") ||
    combined.includes("提前联系")
  ) {
    hints.push("需电话预约");
  }

  // POD
  if (combined.includes("POD")) {
    hints.push("需要 POD");
  }

  // FEDEX 标签
  if (combined.toUpperCase().includes("FEDEX") && combined.includes("不要")) {
    hints.push("外箱有FEDEX标签，不要交快递");
  }

  return hints.length > 0 ? hints.join(" | ") : "无特殊要求";
}

export function parseExcelBuffer(buffer: ArrayBuffer): DispatchRecord[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const containerNo = findContainerNo(sheet) || "UNKNOWN";

  // 处理合并单元格：先解除合并，把值填充到所有单元格
  if (sheet["!merges"]) {
    for (const merge of sheet["!merges"]) {
      const topLeft = sheet[XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c })];
      if (!topLeft) continue;
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          if (r === merge.s.r && c === merge.s.c) continue;
          const addr = XLSX.utils.encode_cell({ r, c });
          sheet[addr] = { ...topLeft };
        }
      }
    }
  }

  const data: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });

  const headerIdx = findHeaderRow(data);
  if (headerIdx === -1) return [];

  const header = data[headerIdx];
  const colMethod = getColIndex(header, "METHOD", "渠道");
  const colCtns = getColIndex(header, "CTNS", "件数");
  const colCbm = getColIndex(header, "CBM");
  const colCode = getColIndex(header, "CODE", "仓库");
  const colAddr = getColIndex(header, "ADDRESS", "地址");
  const colShipId = getColIndex(header, "SHIP", "分货");
  const colNo = getColIndex(header, "NO");

  if (colMethod === -1 || colCtns === -1 || colCbm === -1 || colCode === -1)
    return [];

  // 提取 LTL + LOCAL
  const rows: ShipmentRow[] = [];
  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    const method = String(row[colMethod] || "").trim().toUpperCase();
    if (method !== "LTL" && method !== "LOCAL") continue;

    const ctns = Number(row[colCtns]) || 0;
    const cbm = Number(row[colCbm]) || 0;
    const fbaCode = String(row[colCode] || "").trim();
    const address = colAddr >= 0 ? String(row[colAddr] || "").trim() : "";
    const shipId = colShipId >= 0 ? String(row[colShipId] || "").trim() : "";
    const notes = colNo >= 0 ? String(row[colNo] || "").trim() : "";

    rows.push({
      id: `${containerNo}-${i}`,
      containerNo,
      method: method as "LTL" | "LOCAL",
      shipId,
      ctns,
      cbm,
      fbaCode,
      address,
      description: "",
      notes,
    });
  }

  // 按 method + fbaCode 分组
  const groups = new Map<
    string,
    {
      method: "LTL" | "LOCAL";
      fbaCode: string;
      address: string;
      shipIds: string[];
      totalCtns: number;
      totalCbm: number;
      allNotes: string[];
    }
  >();

  for (const row of rows) {
    const key = `${row.method}|${row.fbaCode}`;
    const existing = groups.get(key);
    if (existing) {
      existing.shipIds.push(row.shipId);
      existing.totalCtns += row.ctns;
      existing.totalCbm += row.cbm;
      if (row.notes) existing.allNotes.push(row.notes);
      if (!existing.address && row.address) existing.address = row.address;
    } else {
      groups.set(key, {
        method: row.method,
        fbaCode: row.fbaCode,
        address: row.address,
        shipIds: [row.shipId],
        totalCtns: row.ctns,
        totalCbm: row.cbm,
        allNotes: row.notes ? [row.notes] : [],
      });
    }
  }

  // 生成结果
  const results: DispatchRecord[] = [];
  let idx = 0;
  for (const [, g] of groups) {
    const pallets = g.totalCbm > 0 ? Math.round(g.totalCbm / 2) : 0;
    const aiHint = analyzeNotes(g.allNotes.join(" "), g.address);

    results.push({
      id: `${containerNo}-${g.method}-${idx++}`,
      containerNo,
      method: g.method,
      destination: g.fbaCode,
      address: g.address,
      cartons: g.totalCtns,
      pallets,
      shipIds: g.shipIds.filter(Boolean),
      aiHint,
      pickupDate: "",
      truckCompany: "",
      costPrice: "",
      totalQuote: "",
      proNumber: "",
      status: "pending",
    });
  }

  return results;
}
