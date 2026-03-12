import { AngelinaChat } from "@/components/angelina/AngelinaChat";

export default function PortalChatPage() {
  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold text-charcoal mb-4">
        Chat with Angelina
      </h1>
      <p className="text-sm text-slate mb-4">
        Ask about your dancer's schedule, classes, rehearsals, attendance, and more.
      </p>
      <AngelinaChat role="parent" mode="fullpage" />
    </div>
  );
}
