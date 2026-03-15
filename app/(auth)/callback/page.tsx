"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function CallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("Signing you in...");

  useEffect(() => {
    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    console.log("[callback] token_hash:", token_hash?.substring(0, 20));
    console.log("[callback] type:", type);

    if (!token_hash || !type) {
      console.error("[callback] missing params");
      router.push("/login?error=missing_params");
      return;
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    supabase.auth
      .verifyOtp({ token_hash, type: type as any })
      .then(({ data, error }) => {
        console.log("[callback] error:", error?.message ?? "none");
        console.log("[callback] session:", !!data?.session);

        if (error || !data?.session) {
          setStatus("Authentication failed. Redirecting...");
          router.push("/login?error=auth_failed");
        } else {
          setStatus("Success! Redirecting...");
          router.push("/admin/dashboard");
        }
      });
  }, [searchParams, router]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        fontFamily: "Montserrat, sans-serif",
        color: "#6B5A99",
      }}
    >
      <p>{status}</p>
    </div>
  );
}
