"use client";

import { DispatchRecord } from "@/lib/parse-excel";

const COLUMNS: { key: DispatchRecord["status"]; label: string; color: string }[] = [
  { key: "pending", label: "待派送", color: "border-yellow-400" },
  { key: "scheduled", label: "已预约", color: "border-blue-400" },
  { key: "in_transit", label: "派送中", color: "border-orange-400" },
  { key: "delivered", label: "已签收", color: "border-green-400" },
];

interface KanbanBoardProps {
  records: DispatchRecord[];
  onUpdate: (id: string, updates: Partial<DispatchRecord>) => void;
}

function KanbanCard({
  record,
  onUpdate,
}: {
  record: DispatchRecord;
  onUpdate: (id: string, updates: Partial<DispatchRecord>) => void;
}) {
  const nextStatus: Record<string, DispatchRecord["status"] | null> = {
    pending: "scheduled",
    scheduled: "in_transit",
    in_transit: "delivered",
    delivered: null,
  };

  const prevStatus: Record<string, DispatchRecord["status"] | null> = {
    pending: null,
    scheduled: "pending",
    in_transit: "scheduled",
    delivered: "in_transit",
  };

  const next = nextStatus[record.status];
  const prev = prevStatus[record.status];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-2 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-xs px-2 py-0.5 rounded font-medium ${
            record.method === "LTL"
              ? "bg-purple-100 text-purple-700"
              : "bg-teal-100 text-teal-700"
          }`}
        >
          {record.method}
        </span>
        <span className="text-xs text-gray-400 font-mono">
          {record.containerNo}
        </span>
      </div>

      <h3 className="font-bold text-gray-900 mb-1">{record.destination}</h3>

      <div className="text-xs text-gray-500 space-y-1 mb-2">
        <div className="flex justify-between">
          <span>板数: <strong className="text-gray-900">{record.pallets}</strong></span>
          <span>箱数: <strong className="text-gray-900">{record.cartons}</strong></span>
        </div>
        {record.truckCompany && (
          <div>卡车: {record.truckCompany}</div>
        )}
        {record.pickupDate && (
          <div>提货: {record.pickupDate}</div>
        )}
      </div>

      {record.aiHint !== "无特殊要求" && (
        <div className="text-xs bg-red-50 text-red-700 rounded px-2 py-1 mb-2 font-medium">
          {record.aiHint}
        </div>
      )}

      <div className="flex gap-1 mt-2">
        {prev && (
          <button
            onClick={() => onUpdate(record.id, { status: prev })}
            className="flex-1 text-xs py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            ← 退回
          </button>
        )}
        {next && (
          <button
            onClick={() => onUpdate(record.id, { status: next })}
            className="flex-1 text-xs py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            {next === "scheduled"
              ? "标记已预约 →"
              : next === "in_transit"
              ? "开始派送 →"
              : "确认签收 →"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({ records, onUpdate }: KanbanBoardProps) {
  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        暂无数据，请上传 Excel 文件
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const items = records.filter((r) => r.status === col.key);
        return (
          <div key={col.key} className="min-h-[300px]">
            <div
              className={`border-t-4 ${col.color} bg-gray-50 rounded-t-lg px-3 py-2 mb-2`}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-700">{col.label}</h2>
                <span className="text-xs bg-white text-gray-500 px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {items.map((record) => (
                <KanbanCard
                  key={record.id}
                  record={record}
                  onUpdate={onUpdate}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
