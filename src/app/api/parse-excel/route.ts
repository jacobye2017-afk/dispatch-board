import { NextRequest, NextResponse } from "next/server";
import { parseExcelBuffer } from "@/lib/parse-excel";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
    return NextResponse.json(
      { error: "Please upload an Excel file (.xlsx)" },
      { status: 400 }
    );
  }

  const buffer = await file.arrayBuffer();
  const records = parseExcelBuffer(buffer);

  return NextResponse.json({
    fileName: file.name,
    recordCount: records.length,
    records,
  });
}
