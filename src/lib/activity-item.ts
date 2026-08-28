export type ActivityItem =
  | {
      kind: "status";
      id: string;
      monitorId: string;
      name: string;
      url: string;
      recovered: boolean;
      at: string;
    }
  | {
      kind: "degradation";
      id: string;
      monitorId: string;
      name: string;
      url: string;
      recentAvgMs: number;
      baselineP75Ms: number;
      at: string;
    };
