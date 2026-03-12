import { AngelinaChat } from "@/components/angelina/AngelinaChat";

export default function AdminChatPage() {
  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold text-charcoal mb-4">
        Angelina — AI Assistant
      </h1>
      <p className="text-sm text-slate mb-4">
        Full studio data access. Ask about enrollment, schedules, leads, staffing, capacity, and more.
      </p>
      <AngelinaChat role="admin" mode="fullpage" />
    </div>
  );
}
