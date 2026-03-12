import { AngelinaChat } from "@/components/angelina/AngelinaChat";

export default function TeachChatPage() {
  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold text-charcoal mb-4">
        Chat with Angelina
      </h1>
      <p className="text-sm text-slate mb-4">
        Ask about your schedule, student rosters, hour logging, and substitute requests.
      </p>
      <AngelinaChat role="teacher" mode="fullpage" />
    </div>
  );
}
