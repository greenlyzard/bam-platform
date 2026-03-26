"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AssistantConfig } from "@/lib/assistant/config";
import { EntryChoiceCard } from "./enrollment-cards/entry-choice-card";
import { AccountCard } from "./enrollment-cards/account-card";
import { DancerCard } from "./enrollment-cards/dancer-card";
import { ClassRecommendationCard } from "./enrollment-cards/class-recommendation-card";
import { ContactCard } from "./enrollment-cards/contact-card";
import { TermsCard } from "./enrollment-cards/terms-card";
import { PaymentCard } from "./enrollment-cards/payment-card";
import { ConfirmationCard } from "./enrollment-cards/confirmation-card";
import { WaitlistCard } from "./enrollment-cards/waitlist-card";

interface ChatMessage { role: "assistant" | "user" | "card"; content: string; cardType?: string; cardProps?: Record<string, unknown>; }
interface EnrollmentData {
  choice: "trial" | "enroll" | null;
  user: { id: string; firstName: string; email: string } | null;
  student: { firstName: string; lastName: string; dob: string; age: number } | null;
  selectedClass: { id: string; name: string; dayTime: string; price: number } | null;
  selectedTime: string | null;
  contact: { phone: string; smsOptIn: boolean; emergencyName: string; emergencyPhone: string; referralSource: string } | null;
  paymentIntent: { clientSecret: string; amount: number } | null;
}
interface EnrollmentChatProps { config: AssistantConfig; studioName: string; tenantId: string; }

const STUDIO_ADDRESS = "400-C Camino De Estrella, San Clemente, CA 92672";

export function EnrollmentChat({ config, studioName, tenantId }: EnrollmentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [step, setStep] = useState(0);
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData>({
    choice: null, user: null, student: null,
    selectedClass: null, selectedTime: null, contact: null, paymentIntent: null,
  });
  const [classes, setClasses] = useState<Record<string, unknown>[]>([]);
  const [trialAbuse, setTrialAbuse] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const initialized = useRef(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setMessages([
      { role: "assistant", content: config.greetingMessage },
      { role: "card", content: "", cardType: "entry-choice" },
    ]);
  }, [config.greetingMessage]);

  function pushMsg(...msgs: ChatMessage[]) {
    setMessages((prev) => [...prev, ...msgs]);
  }

  function addUserMessage(content: string) {
    pushMsg({ role: "user", content });
  }

  function handleChoice(choice: "trial" | "enroll") {
    setEnrollmentData((p) => ({ ...p, choice }));
    addUserMessage(choice === "trial" ? "Free Trial Class" : "Enroll Now");
    pushMsg(
      { role: "assistant", content: `Wonderful! Let's get you set up. Have you visited ${studioName} before?` },
      { role: "card", content: "", cardType: "account" },
    );
    setStep(1);
  }

  function handleAccountComplete(user: { id: string; firstName: string; email: string }) {
    setEnrollmentData((p) => ({ ...p, user }));
    addUserMessage(`Signed in as ${user.firstName}`);
    pushMsg(
      { role: "assistant", content: `Lovely to meet you, ${user.firstName}! What's your dancer's name and birthday?` },
      { role: "card", content: "", cardType: "dancer" },
    );
    setStep(2);
  }

  async function handleDancerComplete(student: { firstName: string; lastName: string; dob: string; age: number }) {
    setEnrollmentData((p) => ({ ...p, student }));
    addUserMessage(`${student.firstName} ${student.lastName}, age ${student.age}`);

    const isTrial = enrollmentData.choice === "trial";

    // Trial abuse check
    if (isTrial && enrollmentData.user) {
      try {
        const res = await fetch("/api/enroll/check-trial-abuse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dob: student.dob, parentEmail: enrollmentData.user.email }),
        });
        const result = await res.json();
        if (result.abused && !result.approved) {
          setTrialAbuse(true);
          pushMsg({
            role: "assistant",
            content: "It looks like a trial class has already been used for this dancer. Please contact the studio directly and we'll be happy to help!",
          });
          return;
        }
      } catch { /* Non-blocking */ }
    }

    pushMsg({ role: "assistant", content: `Based on ${student.firstName}'s age, here are perfect classes at ${studioName}:` });

    try {
      const { data: classData } = await supabase
        .from("classes")
        .select("id, name, description, day_of_week, start_time, age_min, age_max, max_enrollment, enrollment_count, monthly_price")
        .gte("age_max", student.age)
        .lte("age_min", student.age)
        .eq("is_active", true);

      const formatted = (classData || []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        name: c.name as string,
        description: (c.description as string) || "",
        dayTime: `${c.day_of_week} ${c.start_time}`,
        ageRange: `Ages ${c.age_min}-${c.age_max}`,
        spotsRemaining: Math.max(0, ((c.max_enrollment as number) || 20) - ((c.enrollment_count as number) || 0)),
        price: (c.monthly_price as number) || 0,
        isFull: ((c.enrollment_count as number) || 0) >= ((c.max_enrollment as number) || 20),
      }));

      setClasses(formatted);
      pushMsg({ role: "card", content: "", cardType: "class-recommendation", cardProps: { classes: formatted } });
    } catch {
      pushMsg({ role: "assistant", content: "I'm having trouble loading classes right now. Please try again in a moment." });
    }

    setStep(3);
  }

  function handleClassSelect(classId: string, time: string) {
    const cls = classes.find((c: Record<string, unknown>) => c.id === classId) as Record<string, unknown> | undefined;
    if (!cls) return;
    setEnrollmentData((p) => ({
      ...p,
      selectedClass: { id: classId, name: cls.name as string, dayTime: time, price: cls.price as number },
      selectedTime: time,
    }));
    addUserMessage(`Selected: ${cls.name} — ${time}`);
    pushMsg(
      { role: "assistant", content: "Almost done! Just a couple of quick things..." },
      { role: "card", content: "", cardType: "contact" },
    );
    setStep(4);
  }

  function handleWaitlist(classId: string) {
    const cls = classes.find((c: Record<string, unknown>) => c.id === classId) as Record<string, unknown> | undefined;
    if (!cls) return;
    pushMsg({ role: "card", content: "", cardType: "waitlist", cardProps: { className: cls.name as string } });
  }

  function handleWaitlistJoin() {
    pushMsg({
      role: "assistant",
      content: "You've been added to the waitlist! We'll email you as soon as a spot opens up. In the meantime, feel free to select another class.",
    });
  }

  async function handleContactComplete(data: {
    phone: string; smsOptIn: boolean; emergencyName: string; emergencyPhone: string; referralSource: string;
  }) {
    setEnrollmentData((p) => ({ ...p, contact: data }));
    addUserMessage("Contact details provided");

    if (enrollmentData.choice === "trial") {
      await handleTrialComplete();
      return;
    }

    pushMsg(
      { role: "assistant", content: "One last step \u2014 review and accept the enrollment agreement." },
      { role: "card", content: "", cardType: "terms" },
    );
    setStep(5);
  }

  async function handleTermsAccept() {
    addUserMessage("Terms accepted");
    pushMsg({ role: "assistant", content: "You're almost in! Let's take care of payment." });

    try {
      const res = await fetch("/api/enroll/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: enrollmentData.selectedClass?.id,
          amount: (enrollmentData.selectedClass?.price || 0) * 100,
          tenantId,
        }),
      });
      const { clientSecret, amount } = await res.json();
      setEnrollmentData((p) => ({ ...p, paymentIntent: { clientSecret, amount } }));
      pushMsg({ role: "card", content: "", cardType: "payment", cardProps: { clientSecret, amount } });
      setStep(6);
    } catch {
      pushMsg({ role: "assistant", content: "I'm having trouble setting up payment. Please try again or contact the studio." });
    }
  }

  async function handlePaymentSuccess() {
    addUserMessage("Payment complete");
    try {
      const { completeRegistration } = await import("@/app/(public)/enroll/actions");
      await completeRegistration({
        student_first_name: enrollmentData.student!.firstName,
        student_last_name: enrollmentData.student!.lastName,
        student_dob: enrollmentData.student!.dob,
        emergency_contacts: enrollmentData.contact
          ? [{ first_name: enrollmentData.contact.emergencyName.split(" ")[0] || "", last_name: enrollmentData.contact.emergencyName.split(" ").slice(1).join(" ") || "", phone: enrollmentData.contact.emergencyPhone }]
          : [],
        class_ids: [enrollmentData.selectedClass!.id],
      });
    } catch { /* Non-blocking — payment already succeeded */ }
    showConfirmation();
  }

  function handlePaymentError(msg: string) {
    pushMsg({ role: "assistant", content: `There was an issue with your payment: ${msg}. Please try again or use a different payment method.` });
  }

  async function handleTrialComplete() {
    try {
      const formData = new FormData();
      formData.set("childName", `${enrollmentData.student!.firstName} ${enrollmentData.student!.lastName}`);
      formData.set("childAge", String(enrollmentData.student!.age));
      formData.set("email", enrollmentData.user!.email);
      formData.set("classId", enrollmentData.selectedClass!.id);
      formData.set("trialDate", new Date().toISOString().split("T")[0]);
      const { bookTrialClass } = await import("@/app/(public)/enroll/actions");
      await bookTrialClass(formData);
    } catch { /* Non-blocking */ }
    showConfirmation();
  }

  function showConfirmation() {
    const studentName = enrollmentData.student?.firstName || "Your dancer";
    pushMsg(
      { role: "assistant", content: `You're in! ${config.directorName} and the team can't wait to meet ${studentName}.` },
      {
        role: "card", content: "", cardType: "confirmation",
        cardProps: {
          studentName,
          className: enrollmentData.selectedClass?.name || "",
          dayTime: enrollmentData.selectedTime || "",
          studioAddress: STUDIO_ADDRESS,
          studioName,
        },
      },
    );
    setStep(7);
  }

  function renderCard(msg: ChatMessage) {
    switch (msg.cardType) {
      case "entry-choice":
        return <EntryChoiceCard config={config} onChoice={handleChoice} />;
      case "account":
        return <AccountCard config={config} onComplete={handleAccountComplete} />;
      case "dancer":
        return <DancerCard config={config} onComplete={handleDancerComplete} />;
      case "class-recommendation":
        return <ClassRecommendationCard config={config} classes={(msg.cardProps?.classes as never[]) || []} onSelect={handleClassSelect} onWaitlist={handleWaitlist} />;
      case "contact":
        return <ContactCard config={config} onComplete={handleContactComplete} />;
      case "terms":
        return <TermsCard config={config} onAccept={handleTermsAccept} />;
      case "payment":
        return <PaymentCard config={config} clientSecret={msg.cardProps?.clientSecret as string} amount={msg.cardProps?.amount as number} onSuccess={handlePaymentSuccess} onError={handlePaymentError} />;
      case "confirmation":
        return <ConfirmationCard config={config} studentName={msg.cardProps?.studentName as string} className={msg.cardProps?.className as string} dayTime={msg.cardProps?.dayTime as string} studioAddress={msg.cardProps?.studioAddress as string} studioName={msg.cardProps?.studioName as string} />;
      case "waitlist":
        return <WaitlistCard config={config} className={msg.cardProps?.className as string} onJoin={handleWaitlistJoin} />;
      default:
        return null;
    }
  }

  const isTrial = enrollmentData.choice === "trial";
  const totalSteps = isTrial ? 5 : 7;
  const displayStep = Math.min(step, totalSteps);

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((msg, i) => {
          if (msg.role === "card") {
            return (
              <div key={i} className="flex justify-start">
                <div className="ml-8">{renderCard(msg)}</div>
              </div>
            );
          }

          const isAssistant = msg.role === "assistant";

          return (
            <div key={i} className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
              {isAssistant && (
                <div
                  style={{ backgroundColor: `${config.primaryColor}1A` }}
                  className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
                >
                  {config.assistantAvatarUrl ? (
                    <img src={config.assistantAvatarUrl} alt={config.assistantName} className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span style={{ color: config.primaryColor }} className="text-xs font-bold">
                      {config.assistantName.charAt(0)}
                    </span>
                  )}
                </div>
              )}
              <div
                className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${isAssistant ? "bg-white text-charcoal shadow-sm" : "text-white"}`}
                style={!isAssistant ? { backgroundColor: config.primaryColor } : undefined}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
      </div>

      {step > 0 && step < totalSteps && !trialAbuse && (
        <div className="border-t border-silver/30 px-4 py-2 text-center text-xs text-mist">
          Step {displayStep} of {totalSteps}
        </div>
      )}
    </div>
  );
}
