"use client";

import { useState } from "react";

export function CopyIframeButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const iframeCode = `<iframe src="https://portal.balletacademyandmovement.com/widget/schedule/${token}" width="100%" height="700" frameborder="0" style="border:none;" title="Class Schedule — Ballet Academy and Movement"></iframe>`;

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(iframeCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate hover:bg-cloud hover:text-charcoal transition-colors"
      title="Copy iframe embed code"
    >
      {copied ? "Copied!" : "Copy Code"}
    </button>
  );
}
