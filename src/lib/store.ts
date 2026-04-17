import { DispatchRecord } from "./parse-excel";

const STORAGE_KEY = "dispatch-board-records";

export function loadRecords(): DispatchRecord[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveRecords(records: DispatchRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
