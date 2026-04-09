"use client";

import { useTransition } from "react";
import { updateGroupChatMode } from "./actions";

const OPTIONS = [
  { value: "broadcast", label: "Broadcast" },
  { value: "two_way", label: "Two-way" },
  { value: "disabled", label: "Disabled" },
] as const;

type ChatMode = (typeof OPTIONS)[number]["value"];

export function ChatModeToggle({
  groupId,
  value,
}: {
  groupId: string;
  value: ChatMode;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={value}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value as ChatMode;
        startTransition(async () => {
          try {
            await updateGroupChatMode(groupId, next);
          } catch (err) {
            console.error(err);
            alert("Failed to update chat mode");
          }
        });
      }}
      className="appearance-none bg-white border border-silver rounded-md px-3 py-1.5 text-sm text-charcoal focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20 cursor-pointer disabled:opacity-50"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
