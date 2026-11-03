"use client";
import dynamic from "next/dynamic";

const PhoneResult = dynamic(
  () => import("./PhoneResult").then((module) => module.PhoneResult),
  {
    ssr: false,
    loading: () => (
      <main className="p-8" role="status">
        Opening your video…
      </main>
    ),
  },
);
export function PhoneResultLoader() {
  return <PhoneResult />;
}
