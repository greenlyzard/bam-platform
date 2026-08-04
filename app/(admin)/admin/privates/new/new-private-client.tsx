"use client";

import { useRouter } from "next/navigation";
import { PrivateSessionForm } from "@/components/admin/private-session-form";

export function NewPrivateClient({
  tenantId,
  initialDate,
  initialStartTime,
  initialStudio,
  initialLocationId,
}: {
  tenantId: string;
  initialDate?: string;
  initialStartTime?: string;
  initialStudio?: string;
  initialLocationId?: string;
}) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-silver bg-white p-6">
      <PrivateSessionForm
        tenantId={tenantId}
        initialDate={initialDate}
        initialStartTime={initialStartTime}
        initialStudio={initialStudio}
        initialLocationId={initialLocationId}
        onClose={() => router.push("/admin/privates")}
        onCreated={() => router.push("/admin/privates")}
      />
    </div>
  );
}
