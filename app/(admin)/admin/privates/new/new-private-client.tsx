"use client";

import { useRouter } from "next/navigation";
import { PrivateSessionForm } from "@/components/admin/private-session-form";

export function NewPrivateClient({ tenantId }: { tenantId: string }) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-silver bg-white p-6">
      <PrivateSessionForm
        tenantId={tenantId}
        onClose={() => router.push("/admin/privates")}
        onCreated={() => router.push("/admin/privates")}
      />
    </div>
  );
}
