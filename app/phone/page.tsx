import type { Metadata } from "next";
import { PhoneLoader } from "@/components/studio/PhoneLoader";

export const metadata: Metadata = {
  title: "Send from your phone",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function PhonePage() {
  return <PhoneLoader />;
}
