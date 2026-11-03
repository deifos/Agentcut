"use client";

import dynamic from "next/dynamic";

// Pairing keys and saved device state belong to this browser only.
const PhoneApp = dynamic(
  () => import("./PhoneApp").then((module) => module.PhoneApp),
  {
    ssr: false,
    loading: () => (
      <main className="p-8" role="status">
        Loading your phone connection…
      </main>
    ),
  },
);
export function PhoneLoader() {
  return <PhoneApp />;
}
