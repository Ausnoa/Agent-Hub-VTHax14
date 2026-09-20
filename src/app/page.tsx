"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  useEffect(() => {
    const local = ["localhost", "127.0.0.1"].includes(window.location.hostname) && !new URLSearchParams(window.location.search).has("hosted");
    router.replace(local ? "/agents" : "/dashboard");
  }, [router]);
  return null;
}
