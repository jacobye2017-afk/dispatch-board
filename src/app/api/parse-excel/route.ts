import { NextRequest, NextResponse } from "next/server";
import { parseExcelBuffer } from "@/lib/parse-excel";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "无效的表单数据" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "未上传文件" }, { status: 400 });
  }

  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
    return NextResponse.json(
      { error: "请上传 Excel 文件（.xlsx / .xls）" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        error: `文件过大（${(file.size / 1024 / 1024).toFixed(1)} MB），最大支持 ${MAX_FILE_SIZE / 1024 / 1024} MB`,
      },
      { status: 413 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "文件为空" }, { status: 400 });
  }

  try {
    const buffer = await file.arrayBuffer();
    const records = parseExcelBuffer(buffer);

    if (records.length === 0) {
      return NextResponse.json(
        { error: "未能从文件中提取到 LTL/LOCAL 记录，请检查表头与数据" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      fileName: file.name,
      recordCount: records.length,
      records,
    });
  } catch (err) {
    console.error("[parse-excel] error:", err);
    const msg = err instanceof Error ? err.message : "解析失败";
    return NextResponse.json(
      { error: `解析失败：${msg}` },
      { status: 500 }
    );
  }
}
