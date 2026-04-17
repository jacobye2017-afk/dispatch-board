"use client";

import { useState, useEffect, useCallback } from "react";
import FileUpload from "@/components/FileUpload";
import DispatchTable from "@/components/DispatchTable";
import KanbanBoard from "@/components/KanbanBoard";
import {
  DispatchRecord,
  recordsToLtlRows,
  recordsToLocalRows,
  rowsToTsv,
  rowsToCsv,
  LTL_HEADERS,
  LOCAL_HEADERS,
} from "@/lib/parse-excel";
import { loadRecords, saveRecords } from "@/lib/store";

type ViewMode = "table" | "kanban";
type TabFilter = "all" | "LTL" | "LOCAL";

export default function Home() {
  const [records, setRecords] = useState<DispatchRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<ViewMode>("table");
  const [tab, setTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    setRecords(loadRecords());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      saveRecords(records);
    }
  }, [records, loaded]);

  const handleRecordsParsed = useCallback(
    (newRecords: DispatchRecord[]) => {
      setRecords((prev) => {
        // 去重：相同 id 的替换
        const existing = new Map(prev.map((r) => [r.id, r]));
        for (const r of newRecords) {
          existing.set(r.id, r);
        }
        return Array.from(existing.values());
      });
    },
    []
  );

  const handleUpdate = useCallback(
    (id: string, updates: Partial<DispatchRecord>) => {
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
      );
    },
    []
  );

  const handleDelete = useCallback((id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    if (confirm("确定清空所有数据？")) {
      setRecords([]);
      localStorage.removeItem("dispatch-board-records");
    }
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }, []);

  const handleCopy = useCallback(
    async (kind: "LTL" | "LOCAL") => {
      const rows = kind === "LTL" ? recordsToLtlRows(records) : recordsToLocalRows(records);
      if (rows.length === 0) {
        showToast(`没有 ${kind} 数据可复制`);
        return;
      }
      try {
        await navigator.clipboard.writeText(rowsToTsv(rows));
        showToast(`✓ 已复制 ${rows.length} 条 ${kind} 数据，到金山表格按 Ctrl+V 粘贴`);
      } catch {
        showToast("复制失败，请检查浏览器权限");
      }
    },
    [records, showToast]
  );

  const handleExportCsv = useCallback(() => {
    if (records.length === 0) {
      showToast("没有数据可导出");
      return;
    }
    const downloadCsv = (filename: string, headers: string[], rows: string[][]) => {
      const csv = rowsToCsv([headers, ...rows]);
      // BOM 让 Excel 打开不乱码
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    const ltl = recordsToLtlRows(records);
    const local = recordsToLocalRows(records);
    const today = new Date().toISOString().slice(0, 10);
    if (ltl.length > 0) downloadCsv(`dispatch_LTL_${today}.csv`, LTL_HEADERS, ltl);
    if (local.length > 0) downloadCsv(`dispatch_LOCAL_${today}.csv`, LOCAL_HEADERS, local);
    showToast(`✓ 已导出 LTL ${ltl.length} 条、LOCAL ${local.length} 条`);
  }, [records, showToast]);

  // 状态排序顺序：待派送 → 已预约 → 派送中 → 已签收（底部）
  const STATUS_ORDER: Record<DispatchRecord["status"], number> = {
    pending: 0,
    scheduled: 1,
    in_transit: 2,
    delivered: 3,
  };

  const filtered = records
    .filter((r) => {
      if (tab !== "all" && r.method !== tab) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.containerNo.toLowerCase().includes(q) ||
          r.destination.toLowerCase().includes(q) ||
          r.address.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  // 统计
  const stats = {
    total: records.length,
    ltl: records.filter((r) => r.method === "LTL").length,
    local: records.filter((r) => r.method === "LOCAL").length,
    pending: records.filter((r) => r.status === "pending").length,
    scheduled: records.filter((r) => r.status === "scheduled").length,
    inTransit: records.filter((r) => r.status === "in_transit").length,
    delivered: records.filter((r) => r.status === "delivered").length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Dispatch Board
              </h1>
              <p className="text-xs text-gray-500">调度看板</p>
            </div>
            <div className="flex items-center gap-3">
              {/* 统计 */}
              <div className="hidden md:flex items-center gap-2 text-xs">
                <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                  待派送 {stats.pending}
                </span>
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  已预约 {stats.scheduled}
                </span>
                <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded">
                  派送中 {stats.inTransit}
                </span>
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                  已签收 {stats.delivered}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-4 space-y-4">
        {/* Upload */}
        <FileUpload onRecordsParsed={handleRecordsParsed} />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Tab 切换 */}
            {(["all", "LTL", "LOCAL"] as TabFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  tab === t
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {t === "all" ? `全部 (${stats.total})` : `${t} (${stats[t.toLowerCase() as 'ltl' | 'local']})`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* 搜索 */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索柜号/目的地/地址..."
              className="text-sm border border-gray-200 rounded-md px-3 py-1.5 w-[200px]"
            />

            {/* 视图切换 */}
            <div className="flex bg-white border border-gray-200 rounded-md overflow-hidden">
              <button
                onClick={() => setView("table")}
                className={`px-3 py-1.5 text-sm ${
                  view === "table"
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                表格
              </button>
              <button
                onClick={() => setView("kanban")}
                className={`px-3 py-1.5 text-sm ${
                  view === "kanban"
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                看板
              </button>
            </div>

            {records.length > 0 && (
              <>
                <div className="w-px h-6 bg-gray-200 mx-1" />
                <button
                  onClick={() => handleCopy("LTL")}
                  className="text-sm px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors"
                  title="复制 LTL 数据（TSV 格式），在金山表格按 Ctrl+V 粘贴"
                >
                  📋 复制 LTL ({stats.ltl})
                </button>
                <button
                  onClick={() => handleCopy("LOCAL")}
                  className="text-sm px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors"
                  title="复制 LOCAL 数据（TSV 格式），在金山表格按 Ctrl+V 粘贴"
                >
                  📋 复制 LOCAL ({stats.local})
                </button>
                <button
                  onClick={handleExportCsv}
                  className="text-sm px-3 py-1.5 rounded-md bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium transition-colors"
                  title="导出为 CSV 文件（LTL + LOCAL 两个文件）"
                >
                  💾 导出 CSV
                </button>
                <button
                  onClick={handleClearAll}
                  className="text-xs text-gray-400 hover:text-red-500 px-2 py-1"
                >
                  清空
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg border border-gray-200">
          {view === "table" ? (
            <DispatchTable
              records={filtered}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ) : (
            <div className="p-4">
              <KanbanBoard records={filtered} onUpdate={handleUpdate} />
            </div>
          )}
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-bottom-4">
          {toast}
        </div>
      )}
    </div>
  );
}
