"use client";

import { useCallback, useState } from "react";
import { DispatchRecord } from "@/lib/parse-excel";

interface FileUploadProps {
  onRecordsParsed: (records: DispatchRecord[], fileName: string) => void;
}

export default function FileUpload({ onRecordsParsed }: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setMessage("");

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/parse-excel", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (!res.ok) {
          setMessage(data.error || "解析失败");
          return;
        }

        setMessage(
          `${file.name} — 提取 ${data.recordCount} 条记录`
        );
        onRecordsParsed(data.records, file.name);
      } catch {
        setMessage("上传失败，请重试");
      } finally {
        setLoading(false);
      }
    },
    [onRecordsParsed]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
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
        onChange={onFileSelect}
        className="hidden"
        id="excel-upload"
      />
      <label htmlFor="excel-upload" className="cursor-pointer">
        <div className="text-3xl mb-2">📦</div>
        {loading ? (
          <p className="text-gray-500">解析中...</p>
        ) : (
          <>
            <p className="text-gray-600 font-medium">
              拖入 Excel 文件或点击上传
            </p>
            <p className="text-gray-400 text-sm mt-1">
              支持派送方案单 (.xlsx)
            </p>
          </>
        )}
      </label>
      {message && (
        <p className="mt-2 text-sm text-green-600 font-medium">{message}</p>
      )}
    </div>
  );
}
