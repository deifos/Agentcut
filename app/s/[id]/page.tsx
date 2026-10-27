"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { studioShareHash } from "@/lib/studio/share";

/**
 * A share link (`/s/<id>#<key>`). The key is in the fragment, which browsers never send to a
 * server, so the forward to the studio happens here, in the page.
 */
export default function SharePage() {
  const { id } = useParams<{ id: string }>();
  useEffect(() => {
    const key = window.location.hash.replace(/^#/, "");
    window.location.replace(`/studio${studioShareHash(id, key)}`);
  }, [id]);
  return (
    <div className="flex h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
      Opening the shared project…
    </div>
  );
}
