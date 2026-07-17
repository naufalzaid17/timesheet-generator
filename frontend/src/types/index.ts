export interface DailyEntryInput {
  day: number;
  startTime: string;
  endTime: string;
  status: string; // P, S, PM, V, X, or BT
  activity: string;
  projectName: string;
  projectId: string;
  appImpacted: string;
  division: string;
  department: string;
}
