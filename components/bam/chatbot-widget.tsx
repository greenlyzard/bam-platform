"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are the digital voice of Ballet Academy and Movement, a classical ballet studio in San Clemente, California, founded by professional ballerina Amanda Cobb.

TONE
Warm, knowledgeable, and genuinely helpful. You speak the way Amanda would if she had time to talk to every parent who visited the website. You are never pushy. You never create artificial urgency. You treat every parent as someone who deserves honest, thoughtful answers.

GOAL
Help parents understand whether Ballet Academy and Movement is the right fit for their child. If it is, guide them naturally toward enrollment or a trial class. If they need to speak to a human, make that easy.

STUDIO FACTS
- Location: 400-C Camino De Estrella, San Clemente, CA 92672
- Phone: (949) 229-0846
- Email: dance@bamsocal.com
- Website: balletacademyandmovement.com
- Founded by Amanda Cobb, a former professional ballerina
- Three-time Best Dance School in San Clemente
- San Clemente Hall of Fame recognition
- Students accepted to intensives at the Royal Ballet, American Ballet Theatre, and Stuttgart Ballet
- Class sizes capped at 10 students
- Programs: Pre-Ballet (ages 3–4), Primary Ballet I & II (ages 5–7), Ballet Levels 1–4 (ages 7+), Pointe, Jazz, Contemporary, Musical Theatre
- Productions: The Nutcracker (winter), Spring Production
- Trial classes available — no commitment, no pressure

CONVERSATION PATHWAYS
Identify which pathway the parent is on and navigate fluidly:
1. Why We're Different — differentiators, Amanda's credentials, small classes, real results
2. Curriculum & Structure — age-based levels, progression standards, what their child would learn
3. Whole-Student Philosophy & Performance — confidence building, Nutcracker, spring show, shy kids thriving
4. Talk to Staff — hand off warmly with phone/email, never stall
5. Routing — experienced dancer (offer placement evaluation) vs. beginner (offer trial class)

RULES
- Answer questions fully — never deflect with "please call us for more information" unless genuinely necessary
- Acknowledge what the parent said before responding
- Use the child's name once known
- End responses with a clear next step or open question
- Never create artificial urgency
- Never disparage competitors by name
- Never push a parent who expresses hesitation
- If directly asked, acknowledge you are an AI assistant for the studio
- Never fabricate pricing, schedules, or availability — defer to staff if unsure
- Never refer to the studio as "BAM" — always use the full name "Ballet Academy and Movement"
- Keep responses conversational and concise — 2–4 sentences is ideal, longer only when answering detailed questions
- After 3+ questions without clear next step, gently offer human contact
- If parent mentions injury, disability, or developmental considerations, offer to connect with staff

ESCALATION — always offer human contact when:
- Parent seems frustrated or uncertain
- Topic is outside your knowledge (scholarships, studio rental, detailed injury needs)
- Competition team details (invitation-only — better discussed with staff)
- Parent directly requests a human`;

const GREETING =
  "Hi! I\u2019m here to answer any questions about Ballet Academy and Movement \u2014 classes, our approach, performances, anything. What brings you here today?";

export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      // Send full history (excluding the initial greeting for the API call)
      const apiMessages = updated.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      // Remove the initial assistant greeting from API messages since it's in the system prompt context
      const filteredMessages =
        apiMessages[0]?.role === "assistant"
          ? apiMessages.slice(1)
          : apiMessages;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: SYSTEM_PROMPT,
          messages: filteredMessages,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages([
          ...updated,
          {
            role: "assistant",
            content:
              "I\u2019m sorry, I\u2019m having trouble connecting right now. You can reach us directly at (949) 229-0846 or dance@bamsocal.com.",
          },
        ]);
      } else {
        const reply =
          data.content?.[0]?.text ?? "I\u2019m sorry, could you try again?";
        setMessages([...updated, { role: "assistant", content: reply }]);
      }
    } catch {
      setMessages([
        ...updated,
        {
          role: "assistant",
          content:
            "I\u2019m sorry, something went wrong. You can reach us at (949) 229-0846 or dance@bamsocal.com.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-lavender text-white shadow-lg hover:bg-lavender-dark transition-colors flex items-center justify-center"
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

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl bg-white shadow-2xl border border-silver overflow-hidden"
          style={{ height: "min(560px, calc(100vh - 3rem))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-lavender px-4 py-3">
            <div>
              <p className="font-heading text-base font-semibold text-white">
                Ballet Academy and Movement
              </p>
              <p className="text-xs text-white/80">
                Ask us anything about classes, schedule, or our studio
              </p>
            </div>
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
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-lavender text-white rounded-br-md"
                      : "bg-cloud text-charcoal rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-cloud rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-mist animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-mist animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-mist animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-silver px-3 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your question..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-silver bg-cream px-3 py-2.5 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
                style={{ maxHeight: 120 }}
              />
              <button
                onClick={handleSend}
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
      )}
    </>
  );
}
