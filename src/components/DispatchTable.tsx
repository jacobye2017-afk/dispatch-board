"use client";

import { DispatchRecord } from "@/lib/parse-excel";

const STATUS_LABELS: Record<DispatchRecord["status"], string> = {
  pending: "待派送",
  scheduled: "已预约",
  in_transit: "派送中",
  delivered: "已签收",
};

const STATUS_COLORS: Record<DispatchRecord["status"], string> = {
  pending: "bg-yellow-100 text-yellow-800",
  scheduled: "bg-blue-100 text-blue-800",
  in_transit: "bg-orange-100 text-orange-800",
  delivered: "bg-green-100 text-green-800",
};

interface DispatchTableProps {
  records: DispatchRecord[];
  onUpdate: (id: string, updates: Partial<DispatchRecord>) => void;
  onDelete: (id: string) => void;
}

export default function DispatchTable({
  records,
  onUpdate,
  onDelete,
}: DispatchTableProps) {
  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        暂无数据，请上传 Excel 文件
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="px-3 py-2 text-left font-medium">状态</th>
            <th className="px-3 py-2 text-left font-medium">渠道</th>
            <th className="px-3 py-2 text-left font-medium">提货时间</th>
            <th className="px-3 py-2 text-left font-medium">目的地</th>
            <th className="px-3 py-2 text-left font-medium">柜号</th>
            <th className="px-3 py-2 text-left font-medium">卡车公司</th>
            <th className="px-3 py-2 text-left font-medium min-w-[200px]">
              地址
            </th>
            <th className="px-3 py-2 text-center font-medium">板数</th>
            <th className="px-3 py-2 text-center font-medium">箱数</th>
            <th className="px-3 py-2 text-left font-medium">成本价</th>
            <th className="px-3 py-2 text-left font-medium">总报价</th>
            <th className="px-3 py-2 text-left font-medium">PRO#</th>
            <th className="px-3 py-2 text-left font-medium min-w-[150px]">
              AI 提示
            </th>
            <th className="px-3 py-2 text-center font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              key={record.id}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              {/* 状态 */}
              <td className="px-3 py-2">
                <select
                  value={record.status}
                  onChange={(e) =>
                    onUpdate(record.id, {
                      status: e.target.value as DispatchRecord["status"],
                    })
                  }
                  className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${STATUS_COLORS[record.status]}`}
                >
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </td>

              {/* 渠道 */}
              <td className="px-3 py-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                    record.method === "LTL"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-teal-100 text-teal-700"
                  }`}
                >
                  {record.method}
                </span>
              </td>

              {/* 提货时间 */}
              <td className="px-3 py-2">
                <input
                  type="date"
                  value={record.pickupDate}
                  onChange={(e) =>
                    onUpdate(record.id, { pickupDate: e.target.value })
                  }
                  className="text-sm border border-gray-200 rounded px-2 py-1 w-[130px]"
                />
              </td>

              {/* 目的地 */}
              <td className="px-3 py-2 font-medium text-gray-900">
                {record.destination}
              </td>

              {/* 柜号 */}
              <td className="px-3 py-2 font-mono text-xs text-gray-600">
                {record.containerNo}
              </td>

              {/* 卡车公司 */}
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={record.truckCompany}
                  onChange={(e) =>
                    onUpdate(record.id, { truckCompany: e.target.value })
                  }
                  placeholder="—"
                  className="text-sm border border-gray-200 rounded px-2 py-1 w-[80px]"
                />
              </td>

              {/* 地址 */}
              <td className="px-3 py-2 text-xs text-gray-600 max-w-[250px]">
                <div className="line-clamp-3 whitespace-pre-line">
                  {record.address}
                </div>
              </td>

              {/* 板数 */}
              <td className="px-3 py-2 text-center font-bold text-lg">
                {record.pallets}
              </td>

              {/* 箱数 */}
              <td className="px-3 py-2 text-center font-bold text-lg">
                {record.cartons}
              </td>

              {/* 成本价 */}
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={record.costPrice}
                  onChange={(e) =>
                    onUpdate(record.id, { costPrice: e.target.value })
                  }
                  placeholder="$"
                  className="text-sm border border-gray-200 rounded px-2 py-1 w-[80px]"
                />
              </td>

              {/* 总报价 */}
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={record.totalQuote}
                  onChange={(e) =>
                    onUpdate(record.id, { totalQuote: e.target.value })
                  }
                  placeholder="$"
                  className="text-sm border border-gray-200 rounded px-2 py-1 w-[80px]"
                />
              </td>

              {/* PRO# */}
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={record.proNumber}
                  onChange={(e) =>
                    onUpdate(record.id, { proNumber: e.target.value })
                  }
                  placeholder="—"
                  className="text-sm border border-gray-200 rounded px-2 py-1 w-[90px]"
                />
              </td>

              {/* AI 提示 */}
              <td className="px-3 py-2">
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    record.aiHint === "无特殊要求"
                      ? "bg-gray-100 text-gray-500"
                      : "bg-red-50 text-red-700 font-medium"
                  }`}
                >
                  {record.aiHint}
                </span>
              </td>

              {/* 操作 */}
              <td className="px-3 py-2 text-center">
                <button
                  onClick={() => onDelete(record.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="删除"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
