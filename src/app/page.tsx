"use client";

import { useState, useEffect, useCallback } from "react";
import FileUpload from "@/components/FileUpload";
import DispatchTable from "@/components/DispatchTable";
import KanbanBoard from "@/components/KanbanBoard";
import { DispatchRecord } from "@/lib/parse-excel";
import { loadRecords, saveRecords } from "@/lib/store";

type ViewMode = "table" | "kanban";
type TabFilter = "all" | "LTL" | "LOCAL";

export default function Home() {
  const [records, setRecords] = useState<DispatchRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<ViewMode>("table");
  const [tab, setTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");

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

  // 过滤
  const filtered = records.filter((r) => {
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
  });

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
              <button
                onClick={handleClearAll}
                className="text-xs text-gray-400 hover:text-red-500 px-2 py-1"
              >
                清空
              </button>
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
    </div>
  );
}
