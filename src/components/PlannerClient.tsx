"use client";

import dynamic from "next/dynamic";

// The planner reads saved trips, profile, and today's date while rendering,
// so it renders only in the browser (no server/client mismatch).
export const PlannerClient = dynamic(() => import("./Planner").then((m) => m.Planner), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />,
});
