"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { EntryChoiceCard } from "./enrollment-cards/entry-choice-card";
import { AccountCard } from "./enrollment-cards/account-card";
import { DancerCard } from "./enrollment-cards/dancer-card";
import { ClassRecommendationCard } from "./enrollment-cards/class-recommendation-card";
import { ContactCard } from "./enrollment-cards/contact-card";
import { TermsCard } from "./enrollment-cards/terms-card";
import { PaymentCard } from "./enrollment-cards/payment-card";
import { ConfirmationCard } from "./enrollment-cards/confirmation-card";
import { WaitlistCard } from "./enrollment-cards/waitlist-card";

// ── Types ───────────────────────────────────────────────────────

interface ChatMessage {
  role: "angelina" | "user" | "card";
  content: string;
  cardType?: string;
  cardProps?: Record<string, unknown>;
}

interface EnrollmentData {
  choice: "trial" | "enroll" | null;
  user: { id: string; firstName: string; email: string } | null;
  student: { firstName: string; lastName: string; dob: string; age: number } | null;
  selectedClass: { id: string; name: string; dayTime: string; price: number } | null;
  selectedTime: string | null;
  contact: {
    phone: string;
    smsOptIn: boolean;
    emergencyName: string;
    emergencyPhone: string;
    referralSource: string;
  } | null;
  paymentIntent: { clientSecret: string; amount: number } | null;
}

// ── Angelina Scripts ────────────────────────────────────────────

const SCRIPTS: Record<number, string[]> = {
  0: [
    "Hi there! I'm Angelina, your enrollment guide at Ballet Academy and Movement. I'm so excited to help you get started!",
  ],
  1: [
    "Wonderful! First, let's get you set up with an account so we can save your progress.",
  ],
  2: [
    "Now tell me about the dancer who'll be joining us!",
  ],
  3: [
    "Let me find the perfect classes based on your dancer's age and experience.",
  ],
  4: [
    "Almost there! I just need a few contact details for safety and communication.",
  ],
  5: [
    "Please review and accept our enrollment terms to continue.",
  ],
  6: [
    "Last step — let's get payment set up so we can secure your spot!",
  ],
  7: [
    "Welcome to the Ballet Academy and Movement family!",
  ],
};

const TRIAL_SCRIPTS: Record<number, string[]> = {
  0: SCRIPTS[0],
  1: [
    "Let's set up a quick account so we can confirm your trial class.",
  ],
  2: SCRIPTS[2],
  3: [
    "Here are classes that match your dancer — pick one for the free trial!",
  ],
  4: [
    "Just a quick contact detail so we can reach you about the trial.",
  ],
  5: [],
  6: [],
  7: [
    "You're all set for your free trial class! We can't wait to meet your dancer.",
  ],
};

const STUDIO_ADDRESS = "400-C Camino De Estrella, San Clemente, CA 92672";

// ── Component ───────────────────────────────────────────────────

export function EnrollmentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [step, setStep] = useState(0);
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData>({
    choice: null,
    user: null,
    student: null,
    selectedClass: null,
    selectedTime: null,
    contact: null,
    paymentIntent: null,
  });
  const [classes, setClasses] = useState<Record<string, unknown>[]>([]);
  const [trialAbuse, setTrialAbuse] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const initialized = useRef(false);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Initialize with greeting + entry choice card
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const greeting: ChatMessage = {
      role: "angelina",
      content: SCRIPTS[0][0],
    };
    const choiceCard: ChatMessage = {
      role: "card",
      content: "",
      cardType: "entry-choice",
    };
    setMessages([greeting, choiceCard]);
  }, []);

  function addAngelinaMessages(stepNum: number, isTrial: boolean) {
    const scripts = isTrial ? TRIAL_SCRIPTS : SCRIPTS;
    const lines = scripts[stepNum] || [];
    return lines.map(
      (content): ChatMessage => ({ role: "angelina", content })
    );
  }

  function addUserMessage(content: string) {
    setMessages((prev) => [...prev, { role: "user", content }]);
  }

  // ── Step 0: Entry choice ────────────────────────────────────

  function handleChoice(choice: "trial" | "enroll") {
    setEnrollmentData((prev) => ({ ...prev, choice }));
    addUserMessage(choice === "trial" ? "Free Trial Class" : "Enroll Now");

    const isTrial = choice === "trial";
    const newMsgs = addAngelinaMessages(1, isTrial);
    const accountCard: ChatMessage = {
      role: "card",
      content: "",
      cardType: "account",
    };

    setMessages((prev) => [...prev, ...newMsgs, accountCard]);
    setStep(1);
  }

  // ── Step 1: Account ─────────────────────────────────────────

  function handleAccountComplete(user: { id: string; firstName: string; email: string }) {
    setEnrollmentData((prev) => ({ ...prev, user }));
    addUserMessage(`Signed in as ${user.firstName}`);

    const isTrial = enrollmentData.choice === "trial";
    const newMsgs = addAngelinaMessages(2, isTrial);
    const dancerCard: ChatMessage = {
      role: "card",
      content: "",
      cardType: "dancer",
    };

    setMessages((prev) => [...prev, ...newMsgs, dancerCard]);
    setStep(2);
  }

  // ── Step 2: Dancer ──────────────────────────────────────────

  async function handleDancerComplete(student: {
    firstName: string;
    lastName: string;
    dob: string;
    age: number;
  }) {
    setEnrollmentData((prev) => ({ ...prev, student }));
    addUserMessage(`${student.firstName} ${student.lastName}, age ${student.age}`);

    const isTrial = enrollmentData.choice === "trial";

    // Trial abuse check
    if (isTrial && enrollmentData.user) {
      try {
        const res = await fetch("/api/enroll/check-trial-abuse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dob: student.dob,
            parentEmail: enrollmentData.user.email,
          }),
        });
        const result = await res.json();
        if (result.abused && !result.approved) {
          setTrialAbuse(true);
          setMessages((prev) => [
            ...prev,
            {
              role: "angelina",
              content:
                "It looks like a trial class has already been used for this dancer. If you believe this is an error, please contact the studio directly at (949) 229-0846 and we'll be happy to help!",
            },
          ]);
          return;
        }
      } catch {
        // Non-blocking — continue enrollment
      }
    }

    // Fetch classes
    const newMsgs = addAngelinaMessages(3, isTrial);
    setMessages((prev) => [...prev, ...newMsgs]);

    try {
      const { data: classData } = await supabase
        .from("classes")
        .select(
          "id, name, description, day_of_week, start_time, age_min, age_max, max_enrollment, enrollment_count, monthly_price"
        )
        .gte("age_max", student.age)
        .lte("age_min", student.age)
        .eq("is_active", true);

      const formatted = (classData || []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        name: c.name as string,
        description: (c.description as string) || "",
        dayTime: `${c.day_of_week} ${c.start_time}`,
        ageRange: `Ages ${c.age_min}-${c.age_max}`,
        spotsRemaining: Math.max(
          0,
          ((c.max_enrollment as number) || 20) - ((c.enrollment_count as number) || 0)
        ),
        price: (c.monthly_price as number) || 0,
        isFull:
          ((c.enrollment_count as number) || 0) >=
          ((c.max_enrollment as number) || 20),
      }));

      setClasses(formatted);

      const classCard: ChatMessage = {
        role: "card",
        content: "",
        cardType: "class-recommendation",
        cardProps: { classes: formatted },
      };
      setMessages((prev) => [...prev, classCard]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "angelina",
          content:
            "I'm having trouble loading classes right now. Please try again in a moment.",
        },
      ]);
    }

    setStep(3);
  }

  // ── Step 3: Class selection ─────────────────────────────────

  function handleClassSelect(classId: string, time: string) {
    const cls = classes.find((c: Record<string, unknown>) => c.id === classId) as Record<string, unknown> | undefined;
    if (!cls) return;

    setEnrollmentData((prev) => ({
      ...prev,
      selectedClass: {
        id: classId,
        name: cls.name as string,
        dayTime: time,
        price: cls.price as number,
      },
      selectedTime: time,
    }));
    addUserMessage(`Selected: ${cls.name} — ${time}`);

    const isTrial = enrollmentData.choice === "trial";
    const newMsgs = addAngelinaMessages(4, isTrial);
    const contactCard: ChatMessage = {
      role: "card",
      content: "",
      cardType: "contact",
    };

    setMessages((prev) => [...prev, ...newMsgs, contactCard]);
    setStep(4);
  }

  function handleWaitlist(classId: string) {
    const cls = classes.find((c: Record<string, unknown>) => c.id === classId) as Record<string, unknown> | undefined;
    if (!cls) return;

    const waitlistCard: ChatMessage = {
      role: "card",
      content: "",
      cardType: "waitlist",
      cardProps: { className: cls.name as string },
    };
    setMessages((prev) => [...prev, waitlistCard]);
  }

  function handleWaitlistJoin() {
    setMessages((prev) => [
      ...prev,
      {
        role: "angelina",
        content:
          "You've been added to the waitlist! We'll email you as soon as a spot opens up. In the meantime, feel free to select another class if you'd like.",
      },
    ]);
  }

  // ── Step 4: Contact ─────────────────────────────────────────

  async function handleContactComplete(data: {
    phone: string;
    smsOptIn: boolean;
    emergencyName: string;
    emergencyPhone: string;
    referralSource: string;
  }) {
    setEnrollmentData((prev) => ({ ...prev, contact: data }));
    addUserMessage("Contact details provided");

    const isTrial = enrollmentData.choice === "trial";

    // Trial flow skips terms and payment
    if (isTrial) {
      await handleTrialComplete();
      return;
    }

    const newMsgs = addAngelinaMessages(5, false);
    const termsCard: ChatMessage = {
      role: "card",
      content: "",
      cardType: "terms",
    };

    setMessages((prev) => [...prev, ...newMsgs, termsCard]);
    setStep(5);
  }

  // ── Step 5: Terms ───────────────────────────────────────────

  async function handleTermsAccept() {
    addUserMessage("Terms accepted");

    const newMsgs = addAngelinaMessages(6, false);
    setMessages((prev) => [...prev, ...newMsgs]);

    // Create payment intent
    try {
      const res = await fetch("/api/enroll/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: enrollmentData.selectedClass?.id,
          amount: (enrollmentData.selectedClass?.price || 0) * 100,
        }),
      });
      const { clientSecret, amount } = await res.json();

      setEnrollmentData((prev) => ({
        ...prev,
        paymentIntent: { clientSecret, amount },
      }));

      const paymentCard: ChatMessage = {
        role: "card",
        content: "",
        cardType: "payment",
        cardProps: { clientSecret, amount },
      };
      setMessages((prev) => [...prev, paymentCard]);
      setStep(6);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "angelina",
          content:
            "I'm having trouble setting up payment. Please try again or contact us at (949) 229-0846.",
        },
      ]);
    }
  }

  // ── Step 6: Payment success ─────────────────────────────────

  async function handlePaymentSuccess() {
    addUserMessage("Payment complete");

    // Complete registration
    try {
      const { completeRegistration } = await import(
        "@/app/(public)/enroll/actions"
      );

      await completeRegistration({
        student_first_name: enrollmentData.student!.firstName,
        student_last_name: enrollmentData.student!.lastName,
        student_dob: enrollmentData.student!.dob,
        emergency_contacts: enrollmentData.contact
          ? [
              {
                first_name: enrollmentData.contact.emergencyName.split(" ")[0] || "",
                last_name: enrollmentData.contact.emergencyName.split(" ").slice(1).join(" ") || "",
                phone: enrollmentData.contact.emergencyPhone,
              },
            ]
          : [],
        class_ids: [enrollmentData.selectedClass!.id],
      });
    } catch {
      // Non-blocking — payment already succeeded
    }

    showConfirmation();
  }

  function handlePaymentError(msg: string) {
    setMessages((prev) => [
      ...prev,
      {
        role: "angelina",
        content: `There was an issue with your payment: ${msg}. Please try again or use a different payment method.`,
      },
    ]);
  }

  // ── Trial completion ────────────────────────────────────────

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
    } catch {
      // Non-blocking
    }

    showConfirmation();
  }

  function showConfirmation() {
    const newMsgs = addAngelinaMessages(7, enrollmentData.choice === "trial");
    const confirmCard: ChatMessage = {
      role: "card",
      content: "",
      cardType: "confirmation",
      cardProps: {
        studentName: enrollmentData.student?.firstName || "Your dancer",
        className: enrollmentData.selectedClass?.name || "",
        dayTime: enrollmentData.selectedTime || "",
        studioAddress: STUDIO_ADDRESS,
      },
    };

    setMessages((prev) => [...prev, ...newMsgs, confirmCard]);
    setStep(7);
  }

  // ── Render card by type ─────────────────────────────────────

  function renderCard(msg: ChatMessage) {
    switch (msg.cardType) {
      case "entry-choice":
        return <EntryChoiceCard onChoice={handleChoice} />;
      case "account":
        return <AccountCard onComplete={handleAccountComplete} />;
      case "dancer":
        return <DancerCard onComplete={handleDancerComplete} />;
      case "class-recommendation":
        return (
          <ClassRecommendationCard
            classes={(msg.cardProps?.classes as never[]) || []}
            onSelect={handleClassSelect}
            onWaitlist={handleWaitlist}
          />
        );
      case "contact":
        return <ContactCard onComplete={handleContactComplete} />;
      case "terms":
        return <TermsCard onAccept={handleTermsAccept} />;
      case "payment":
        return (
          <PaymentCard
            clientSecret={msg.cardProps?.clientSecret as string}
            amount={msg.cardProps?.amount as number}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        );
      case "confirmation":
        return (
          <ConfirmationCard
            studentName={msg.cardProps?.studentName as string}
            className={msg.cardProps?.className as string}
            dayTime={msg.cardProps?.dayTime as string}
            studioAddress={msg.cardProps?.studioAddress as string}
          />
        );
      case "waitlist":
        return (
          <WaitlistCard
            className={msg.cardProps?.className as string}
            onJoin={handleWaitlistJoin}
          />
        );
      default:
        return null;
    }
  }

  // ── Total steps ─────────────────────────────────────────────

  const isTrial = enrollmentData.choice === "trial";
  const totalSteps = isTrial ? 5 : 7;
  const displayStep = Math.min(step, totalSteps);

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.map((msg, i) => {
          if (msg.role === "card") {
            return (
              <div key={i} className="flex justify-start">
                <div className="ml-8">{renderCard(msg)}</div>
              </div>
            );
          }

          const isAngelina = msg.role === "angelina";

          return (
            <div
              key={i}
              className={`flex ${isAngelina ? "justify-start" : "justify-end"}`}
            >
              {isAngelina && (
                <div className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lavender/10 text-sm">
                  🩰
                </div>
              )}
              <div
                className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${
                  isAngelina
                    ? "bg-white text-charcoal shadow-sm"
                    : "bg-lavender text-white"
                }`}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step indicator */}
      {step > 0 && step < totalSteps && !trialAbuse && (
        <div className="border-t border-silver/30 px-4 py-2 text-center text-xs text-mist">
          Step {displayStep} of {totalSteps}
        </div>
      )}
    </div>
  );
}
