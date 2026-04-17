import ExcelJS from "exceljs";

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

// exceljs 的 cell.value 类型很多：string | number | Date | null | { result } | { richText } | { hyperlink }
// 这里统一拍平成字符串；公式取 result；富文本拼接 text。
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("result" in v && v.result !== null && v.result !== undefined) return cellText(v.result);
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((part) => (part as { text?: string }).text ?? "").join("");
    }
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("hyperlink" in v && typeof v.hyperlink === "string") return String(v.text ?? v.hyperlink);
  }
  return String(value);
}

function cellNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "result" in value) {
    const r = (value as { result: unknown }).result;
    if (typeof r === "number") return r;
  }
  const n = Number(cellText(value));
  return Number.isFinite(n) ? n : 0;
}

function findContainerNo(ws: ExcelJS.Worksheet): string | null {
  const maxRow = Math.min(5, ws.rowCount);
  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= row.cellCount; c++) {
      const text = cellText(row.getCell(c).value);
      const match = text.match(/[A-Z]{4}\d{7}/);
      if (match) return match[0];
    }
  }
  return null;
}

function findHeaderRow(ws: ExcelJS.Worksheet): number {
  const maxRow = Math.min(10, ws.rowCount);
  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= row.cellCount; c++) {
      const text = cellText(row.getCell(c).value).toUpperCase();
      if (text.includes("METHOD") || text.includes("渠道")) return r;
    }
  }
  return -1;
}

// "exact:NO" → 完全匹配 "NO"；普通字符串 → includes 匹配
function getColIndex(ws: ExcelJS.Worksheet, headerRow: number, ...keywords: string[]): number {
  const row = ws.getRow(headerRow);
  for (let c = 1; c <= row.cellCount; c++) {
    const val = cellText(row.getCell(c).value).toUpperCase().trim();
    for (const k of keywords) {
      if (k.startsWith("exact:")) {
        if (val === k.slice(6).toUpperCase()) return c;
      } else if (val.includes(k.toUpperCase())) {
        return c;
      }
    }
  }
  return -1;
}

function analyzeNotes(notes: string, address: string, description: string = ""): string {
  const combined = `${notes} ${address} ${description}`;
  const lower = combined.toLowerCase();
  const hints: string[] = [];

  const emailMatch = combined.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) hints.push(`需邮件预约 (${emailMatch[0]})`);

  if (lower.includes("lift gate") || lower.includes("liftgate")) hints.push("需要 Lift Gate");

  if (combined.includes("不用预约") || combined.includes("无需预约") || lower.includes("no appointment")) {
    hints.push("无需预约");
  }

  if (combined.includes("预约") && !combined.includes("不用预约") && !combined.includes("无需预约")) {
    hints.push("需预约派送");
  }

  if (combined.includes("电话预约") || combined.includes("送货前电话") || combined.includes("提前联系")) {
    hints.push("需电话预约");
  }

  if (combined.includes("POD")) hints.push("需要 POD");

  if (combined.toUpperCase().includes("FEDEX") && combined.includes("不要")) {
    hints.push("外箱有FEDEX标签，不要交快递");
  }

  return hints.length > 0 ? hints.join(" | ") : "无特殊要求";
}

export async function parseExcelBuffer(buffer: ArrayBuffer): Promise<DispatchRecord[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const ws = workbook.worksheets[0];
  if (!ws) return [];

  const containerNo = findContainerNo(ws) || "UNKNOWN";

  const headerRow = findHeaderRow(ws);
  if (headerRow === -1) return [];

  const colMethod = getColIndex(ws, headerRow, "METHOD", "渠道");
  const colCtns = getColIndex(ws, headerRow, "CTNS", "件数");
  const colCbm = getColIndex(ws, headerRow, "CBM");
  const colCode = getColIndex(ws, headerRow, "CODE", "仓库");
  const colAddr = getColIndex(ws, headerRow, "ADDRESS", "地址");
  const colShipId = getColIndex(ws, headerRow, "SHIP", "分货");
  const colDesc = getColIndex(ws, headerRow, "DESCRIPTION", "品名");
  const colNo = getColIndex(ws, headerRow, "exact:NO");

  if (colMethod === -1 || colCtns === -1 || colCbm === -1 || colCode === -1) return [];

  // exceljs 自动从合并单元格的 master 取值，所以不用手动填充。
  const rows: ShipmentRow[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);

    const method = cellText(row.getCell(colMethod).value).trim().toUpperCase();
    if (method !== "LTL" && method !== "LOCAL") continue;

    const ctns = Math.trunc(cellNumber(row.getCell(colCtns).value));
    const cbm = cellNumber(row.getCell(colCbm).value);
    const fbaCode = cellText(row.getCell(colCode).value).trim();
    const address = colAddr > 0 ? cellText(row.getCell(colAddr).value).trim() : "";
    const shipId = colShipId > 0 ? cellText(row.getCell(colShipId).value).trim() : "";
    const description = colDesc > 0 ? cellText(row.getCell(colDesc).value).trim() : "";
    const notes = colNo > 0 ? cellText(row.getCell(colNo).value).trim() : "";

    rows.push({
      id: `${containerNo}-${r}`,
      containerNo,
      method: method as "LTL" | "LOCAL",
      shipId,
      ctns,
      cbm,
      fbaCode,
      address,
      description,
      notes,
    });
  }

  // 按 (method, fbaCode) 分组聚合
  type Group = {
    method: "LTL" | "LOCAL";
    fbaCode: string;
    address: string;
    shipIds: string[];
    totalCtns: number;
    totalCbm: number;
    descriptions: string[];
    allNotes: string[];
  };

  const groups = new Map<string, Group>();
  for (const row of rows) {
    const key = `${row.method}|${row.fbaCode}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        method: row.method,
        fbaCode: row.fbaCode,
        address: row.address,
        shipIds: [],
        totalCtns: 0,
        totalCbm: 0,
        descriptions: [],
        allNotes: [],
      };
      groups.set(key, g);
    }
    g.shipIds.push(row.shipId);
    g.totalCtns += row.ctns;
    g.totalCbm += row.cbm;
    if (row.description && !g.descriptions.includes(row.description)) g.descriptions.push(row.description);
    if (row.notes) g.allNotes.push(row.notes);
    if (!g.address && row.address) g.address = row.address;
  }

  const results: DispatchRecord[] = [];
  let idx = 0;
  for (const g of groups.values()) {
    const pallets = g.totalCbm > 0 ? Math.round(g.totalCbm / 2) : 0;
    const aiHint = analyzeNotes(g.allNotes.join(" "), g.address, g.descriptions.join(" "));

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

// ========== 导出 / 复制 ==========

// LTL 13 列：提货时间 / 目的地 / 柜号 / 卡车公司 / 地址 / 板数 / 箱子数 /
// 成本价 / 总报价 / 港前报价 / PRO# / 系统批次号 / 备注
export function recordsToLtlRows(records: DispatchRecord[]): string[][] {
  return records
    .filter((r) => r.method === "LTL")
    .map((r) => [
      r.pickupDate,
      r.destination,
      r.containerNo,
      r.truckCompany,
      r.address.replace(/\n/g, " "),
      String(r.pallets),
      String(r.cartons),
      r.costPrice,
      r.totalQuote,
      "",
      r.proNumber,
      "",
      `根据ai分析：${r.aiHint}，详情请看派单！`,
    ]);
}

// LOCAL 9 列：日期 / Destination / 柜号 / Carrier / 地址 / 板数 / 箱数 /
// 系统批次号 / 备注
export function recordsToLocalRows(records: DispatchRecord[]): string[][] {
  return records
    .filter((r) => r.method === "LOCAL")
    .map((r) => [
      r.pickupDate,
      r.destination,
      r.containerNo,
      r.truckCompany,
      r.address.replace(/\n/g, " "),
      String(r.pallets),
      String(r.cartons),
      "",
      `根据ai分析：${r.aiHint}，详情请看派单！`,
    ]);
}

export const LTL_HEADERS = [
  "提货时间", "目的地", "柜号", "卡车公司", "地址", "板数", "箱子数",
  "成本价", "总报价", "港前报价", "PRO#", "系统批次号", "备注",
];

export const LOCAL_HEADERS = [
  "日期", "Destination", "柜号", "Carrier", "地址", "板数", "箱数",
  "系统批次号", "备注",
];

export function rowsToTsv(rows: string[][]): string {
  return rows.map((row) => row.join("\t")).join("\n");
}

function csvEscape(cell: string): string {
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
}
