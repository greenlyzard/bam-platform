import { ChatbotWidget } from "@/components/bam/chatbot-widget";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <ChatbotWidget />
    </>
  );
}
