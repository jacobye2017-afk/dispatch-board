"use client";

import { useCallback, useState } from "react";
import { DispatchRecord } from "@/lib/parse-excel";

interface FileUploadProps {
  onRecordsParsed: (records: DispatchRecord[], fileName: string) => void;
}

async function parseOne(file: File): Promise<{
  ok: boolean;
  count: number;
  records: DispatchRecord[];
  error?: string;
}> {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await fetch("/api/parse-excel", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, count: 0, records: [], error: data.error || "解析失败" };
    }
    return { ok: true, count: data.recordCount, records: data.records };
  } catch {
    return { ok: false, count: 0, records: [], error: "上传失败" };
  }
}

export default function FileUpload({ onRecordsParsed }: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const excelFiles = files.filter(
        (f) => f.name.toLowerCase().endsWith(".xlsx") || f.name.toLowerCase().endsWith(".xls")
      );
      if (excelFiles.length === 0) {
        setMessage("请选择 .xlsx 或 .xls 文件");
        return;
      }

      setLoading(true);
      setMessage(`解析中 0 / ${excelFiles.length}...`);

      let totalNew = 0;
      const errors: string[] = [];

      for (let i = 0; i < excelFiles.length; i++) {
        const file = excelFiles[i];
        setMessage(`解析中 ${i + 1} / ${excelFiles.length}：${file.name}`);
        const result = await parseOne(file);
        if (!result.ok) {
          errors.push(`${file.name}: ${result.error}`);
        } else {
          totalNew += result.count;
          onRecordsParsed(result.records, file.name);
        }
      }

      setLoading(false);
      const okCount = excelFiles.length - errors.length;
      let msg = `✓ ${okCount} 个文件解析完成，共 ${totalNew} 条新记录`;
      if (errors.length > 0) {
        msg += `\n⚠ ${errors.length} 个失败：${errors.join("; ")}`;
      }
      setMessage(msg);
    },
    [onRecordsParsed]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(Array.from(e.dataTransfer.files));
    },
    [handleFiles]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(Array.from(e.target.files ?? []));
      e.target.value = "";
    },
    [handleFiles]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
        dragging
          ? "border-blue-500 bg-blue-50"
          : "border-gray-300 hover:border-gray-400"
      }`}
    >
      <input
        type="file"
        accept=".xlsx,.xls"
        multiple
        onChange={onFileSelect}
        className="hidden"
        id="excel-upload"
      />
      <label htmlFor="excel-upload" className="cursor-pointer">
        <div className="text-3xl mb-2">📦</div>
        {loading ? (
          <p className="text-gray-500 whitespace-pre-line">{message || "解析中..."}</p>
        ) : (
          <>
            <p className="text-gray-600 font-medium">
              拖入 Excel 文件或点击上传（支持多选）
            </p>
            <p className="text-gray-400 text-sm mt-1">
              支持派送方案单 (.xlsx / .xls)
            </p>
          </>
        )}
      </label>
      {!loading && message && (
        <p className="mt-2 text-sm text-green-600 font-medium whitespace-pre-line">{message}</p>
      )}
    </div>
  );
}
