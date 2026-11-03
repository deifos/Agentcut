import type { Metadata } from "next";
import { PhoneResultLoader } from "@/components/studio/PhoneResultLoader";

export const metadata: Metadata = {
  title: "Your video",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function PhoneResultPage() {
  return <PhoneResultLoader />;
}
