"use client";

import dynamic from "next/dynamic";

// The trip lives in the URL fragment, which only the browser can read.
export const SharedTripClient = dynamic(() => import("./SharedTrip").then((m) => m.SharedTrip), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />,
});
