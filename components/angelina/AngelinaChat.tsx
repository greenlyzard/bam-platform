"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AngelinaChatProps {
  role: "public" | "parent" | "teacher" | "admin";
  mode: "floating" | "fullpage" | "embed";
  initialMessage?: string;
  placeholder?: string;
  primaryColor?: string;
  enabled?: boolean;
}

const SUGGESTED_PROMPTS: Record<string, string[]> = {
  public: [
    "What classes do you have for a 5-year-old?",
    "How much do classes cost?",
    "Can we try a class first?",
  ],
  parent: [
    "What's on my dancer's schedule this week?",
    "When is the next rehearsal?",
    "Show me recent attendance",
  ],
  teacher: [
    "What classes do I have today?",
    "Show me my student roster",
    "How many hours have I logged this week?",
  ],
  admin: [
    "Give me a studio snapshot for today",
    "Which classes have open spots?",
    "Show me new leads this week",
  ],
};

const GREETING: Record<string, string> = {
  public:
    "Hi! I'm Angelina, the assistant for Ballet Academy and Movement. I'd love to help you find the perfect class for your dancer. What brings you here today?",
  parent:
    "Hi! I'm Angelina. I can help you with your dancer's schedule, classes, rehearsals, and more. What can I help you with?",
  teacher:
    "Hi! I'm Angelina. I can help with your schedule, student rosters, hour logging, and substitute requests. What do you need?",
  admin:
    "Hi! I'm Angelina. I have a full view of studio operations. Ask me about enrollment, schedules, leads, staffing, or anything else.",
};

export function AngelinaChat({
  role,
  mode,
  initialMessage,
  placeholder = "Type your message...",
  enabled = true,
}: AngelinaChatProps) {
  if (!enabled) return null;
  const [open, setOpen] = useState(mode !== "floating");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: GREETING[role] },
  ]);
  const [input, setInput] = useState(initialMessage ?? "");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [feedbackGiven, setFeedbackGiven] = useState<Record<number, string>>(
    {}
  );
  const [leadCaptured, setLeadCaptured] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Auto-grow textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  }

  async function handleSend(text?: string) {
    const messageText = (text ?? input).trim();
    if (!messageText || loading) return;

    const userMessage: Message = { role: "user", content: messageText };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setInput("");
    setLoading(true);
    setStreamingText("");

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      const response = await fetch("/api/angelina/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          sessionId,
          conversationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setMessages([
          ...updated,
          {
            role: "assistant",
            content:
              errorData.error ??
              "I'm sorry, something went wrong. You can reach us at (949) 229-0846 or dance@bamsocal.com.",
          },
        ]);
        setLoading(false);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              assistantText += parsed.text;
              setStreamingText(assistantText);
            }
            if (parsed.conversationId) {
              setConversationId(parsed.conversationId);
            }
            if (parsed.error) {
              assistantText = parsed.error;
              setStreamingText(assistantText);
            }
          } catch {
            // skip unparseable lines
          }
        }
      }

      setMessages([
        ...updated,
        { role: "assistant", content: assistantText || "I'm sorry, could you try again?" },
      ]);
      setStreamingText("");

      // Lead capture: after 3+ user messages in public chat
      if (
        role === "public" &&
        !leadCaptured &&
        updated.filter((m) => m.role === "user").length >= 3
      ) {
        tryExtractLead(assistantText, updated);
      }
    } catch {
      setMessages([
        ...updated,
        {
          role: "assistant",
          content:
            "I'm sorry, something went wrong. You can reach us at (949) 229-0846 or dance@bamsocal.com.",
        },
      ]);
      setStreamingText("");
    } finally {
      setLoading(false);
    }
  }

  function tryExtractLead(
    _assistantText: string,
    allMessages: Message[]
  ) {
    // Look for email pattern in user messages
    const allUserText = allMessages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join(" ");

    const emailMatch = allUserText.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    );
    if (emailMatch && conversationId) {
      // Extract age if mentioned
      const ageMatch = allUserText.match(
        /(\d{1,2})\s*(?:year|yr|y\.?o\.?|years?\s*old)/i
      );
      const childAge = ageMatch ? parseInt(ageMatch[1], 10) : undefined;

      fetch("/api/angelina/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          email: emailMatch[0],
          childAge,
        }),
      }).catch(() => {});

      setLeadCaptured(true);
    }
  }

  async function handleFeedback(
    messageIndex: number,
    rating: "helpful" | "not_helpful"
  ) {
    if (feedbackGiven[messageIndex]) return;
    setFeedbackGiven((prev) => ({ ...prev, [messageIndex]: rating }));

    if (conversationId) {
      fetch("/api/angelina/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          messageIndex,
          rating,
        }),
      }).catch(() => {});
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const showSuggestions =
    messages.length === 1 && messages[0].role === "assistant";

  // ── Render ──────────────────────────────────────────────

  const chatContent = (
    <div
      className={`flex flex-col bg-white ${
        mode === "fullpage"
          ? "h-[calc(100vh-8rem)] max-w-3xl mx-auto rounded-2xl border border-silver shadow-sm"
          : mode === "embed"
            ? "h-full"
            : ""
      }`}
      style={
        mode === "floating"
          ? { height: "min(560px, calc(100vh - 3rem))" }
          : undefined
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between bg-lavender px-4 py-3 shrink-0 rounded-t-2xl">
        <div>
          <p className="font-heading text-base font-semibold text-white">
            Angelina
          </p>
          <p className="text-xs text-white/80">
            {role === "public"
              ? "Ballet Academy and Movement"
              : "AI Studio Assistant"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-xs text-white/80">Online</span>
          {mode === "floating" && (
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="ml-2 h-8 w-8 rounded-full text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.map((msg, i) => (
          <div key={i}>
            <div
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-lavender text-white rounded-br-md"
                    : "bg-cloud text-charcoal rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>
            </div>
            {/* Feedback buttons for assistant messages (skip greeting) */}
            {msg.role === "assistant" && i > 0 && (
              <div className="flex gap-1 mt-1 ml-1">
                <button
                  onClick={() => handleFeedback(i, "helpful")}
                  className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                    feedbackGiven[i] === "helpful"
                      ? "text-green-600 bg-green-50"
                      : "text-mist hover:text-slate"
                  }`}
                  disabled={!!feedbackGiven[i]}
                  aria-label="Mark as helpful"
                >
                  {feedbackGiven[i] === "helpful" ? "Helpful!" : "\u{1F44D}"}
                </button>
                <button
                  onClick={() => handleFeedback(i, "not_helpful")}
                  className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                    feedbackGiven[i] === "not_helpful"
                      ? "text-red-600 bg-red-50"
                      : "text-mist hover:text-slate"
                  }`}
                  disabled={!!feedbackGiven[i]}
                  aria-label="Mark as not helpful"
                >
                  {feedbackGiven[i] === "not_helpful" ? "Thanks" : "\u{1F44E}"}
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Streaming text */}
        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed bg-cloud text-charcoal whitespace-pre-wrap">
              {streamingText}
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {loading && !streamingText && (
          <div className="flex justify-start">
            <div className="bg-cloud rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
              <span
                className="h-2 w-2 rounded-full bg-mist animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="h-2 w-2 rounded-full bg-mist animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-2 w-2 rounded-full bg-mist animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        )}

        {/* Suggested prompts */}
        {showSuggestions && (
          <div className="flex flex-col gap-2 pt-2">
            {(SUGGESTED_PROMPTS[role] ?? []).map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                className="text-left text-sm px-3 py-2 rounded-xl border border-lavender/30 text-lavender-dark hover:bg-lavender/5 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-silver px-3 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-silver bg-cream px-3 py-2.5 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            aria-label="Send message"
            className="h-10 w-10 rounded-xl bg-lavender text-white flex items-center justify-center hover:bg-lavender-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m22 2-7 20-4-9-9-4z" />
              <path d="m22 2-11 11" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  // ── Mode wrappers ──────────────────────────────────────

  if (mode === "embed") {
    return <div className="h-screen w-full">{chatContent}</div>;
  }

  if (mode === "fullpage") {
    return <div className="py-2">{chatContent}</div>;
  }

  // Floating mode
  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat with Angelina"
          className="fixed bottom-20 right-6 z-50 h-14 w-14 rounded-full bg-lavender text-white shadow-lg hover:bg-lavender-dark transition-colors flex items-center justify-center sm:bottom-6"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl border border-silver overflow-hidden sm:bottom-6">
          {chatContent}
        </div>
      )}
    </>
  );
}
