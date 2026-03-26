"use client";

import { useState, useRef, useEffect } from "react";
import type { AssistantConfig } from "@/lib/assistant/config";
import { StudentSelectionCard } from "@/components/assistant/enrollment-cards/student-selection-card";
import { ClassRecommendationCard } from "@/components/assistant/enrollment-cards/class-recommendation-card";
import { LevelUpCard } from "@/components/assistant/enrollment-cards/level-up-card";
import { QuickConfirmCard } from "@/components/assistant/enrollment-cards/quick-confirm-card";
import { PaymentCard } from "@/components/assistant/enrollment-cards/payment-card";
import { ConfirmationCard } from "@/components/assistant/enrollment-cards/confirmation-card";
import { getReEnrollmentClasses, enrollExistingStudent, requestLevelUp } from "./actions";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  currentLevel: string | null;
  enrolledClasses: string[];
}

interface ClassOption {
  id: string;
  name: string;
  description: string;
  dayTime: string;
  ageRange: string;
  spotsRemaining: number;
  price: number;
  isFull: boolean;
  level: string | null;
}

interface ChatMessage {
  role: "assistant" | "user" | "card";
  content: string;
  cardType?: string;
  cardProps?: Record<string, unknown>;
}

interface ReEnrollmentChatProps {
  config: AssistantConfig;
  studioName: string;
  tenantId: string;
  parentFirstName: string;
  students: Student[];
  userId: string;
}

const STUDIO_ADDRESS = "400-C Camino De Estrella, San Clemente, CA 92672";

export function ReEnrollmentChat({
  config,
  studioName,
  tenantId,
  parentFirstName,
  students,
  userId,
}: ReEnrollmentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [step, setStep] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [availableClasses, setAvailableClasses] = useState<ClassOption[]>([]);
  const [levelUpOptions, setLevelUpOptions] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null);
  const [savedCard, setSavedCard] = useState<string | null>(null);
  const [paymentSecret, setPaymentSecret] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setMessages([
      {
        role: "assistant",
        content: `Welcome back, ${parentFirstName}! I'm ${config.assistantName}. Ready to add another class? Let's pick a dancer first.`,
      },
      { role: "card", content: "", cardType: "student-selection" },
    ]);
  }, [parentFirstName, config.assistantName]);

  function pushMsg(...msgs: ChatMessage[]) {
    setMessages((prev) => [...prev, ...msgs]);
  }

  function addUserMessage(content: string) {
    pushMsg({ role: "user", content });
  }

  // Step A: Student selected
  async function handleStudentSelect(studentId: string) {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    setSelectedStudent(student);
    addUserMessage(`${student.firstName} ${student.lastName}`);
    pushMsg({
      role: "assistant",
      content: `Great choice! Let me find available classes for ${student.firstName}...`,
    });

    try {
      const fd = new FormData();
      fd.set("studentId", studentId);
      const result = await getReEnrollmentClasses(fd);
      setAvailableClasses(result.classes);
      setLevelUpOptions(result.levelUpOptions);

      if (result.classes.length === 0) {
        pushMsg({
          role: "assistant",
          content: `It looks like ${student.firstName} is enrolled in all available classes right now. Contact us if you'd like to explore private lessons or other options!`,
        });
        return;
      }

      pushMsg({
        role: "assistant",
        content: `Here are the classes available for ${student.firstName}:`,
      });
      pushMsg({ role: "card", content: "", cardType: "class-recommendation" });

      if (result.levelUpOptions.length > 0) {
        pushMsg({ role: "card", content: "", cardType: "level-up" });
      }

      setStep(1);
    } catch {
      pushMsg({
        role: "assistant",
        content: "Sorry, I had trouble loading classes. Please try again or contact the studio.",
      });
    }
  }

  function handleAddNewDancer() {
    addUserMessage("Add a new dancer");
    pushMsg({
      role: "assistant",
      content: `To add a new dancer, please visit our full enrollment page. I'll redirect you now!`,
    });
    window.location.href = `/enroll?studio=${tenantId}`;
  }

  // Step B: Class selected
  async function handleClassSelect(classId: string, time: string) {
    const cls = availableClasses.find((c) => c.id === classId);
    if (!cls || !selectedStudent) return;
    setSelectedClass(cls);
    addUserMessage(`${cls.name} — ${time}`);

    // Pre-enroll to check saved card
    try {
      const fd = new FormData();
      fd.set("studentId", selectedStudent.id);
      fd.set("classId", classId);
      fd.set("tenantId", tenantId);
      const result = await enrollExistingStudent(fd);
      setSavedCard(result.savedCard);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Enrollment failed";
      pushMsg({ role: "assistant", content: `There was an issue: ${msg}` });
      return;
    }

    pushMsg({
      role: "assistant",
      content: `Wonderful! Let's confirm the details for ${selectedStudent.firstName}:`,
    });
    pushMsg({ role: "card", content: "", cardType: "quick-confirm" });
    setStep(2);
  }

  function handleWaitlist(classId: string) {
    const cls = availableClasses.find((c) => c.id === classId);
    addUserMessage(`Join waitlist for ${cls?.name ?? "class"}`);
    pushMsg({
      role: "assistant",
      content: `We've added ${selectedStudent?.firstName ?? "your dancer"} to the waitlist. ${config.directorName} will reach out as soon as a spot opens!`,
    });
  }

  // Level up request
  async function handleLevelUpRequest() {
    if (!selectedStudent || levelUpOptions.length === 0) return;
    const target = levelUpOptions[0];
    addUserMessage(`Request level up to ${target.name}`);

    try {
      // Find current class at the level below
      const currentClass = availableClasses.find((c) => {
        if (!c.level || !target.level) return false;
        const currentNum = parseInt(c.level.replace(/\D/g, ""), 10);
        const targetNum = parseInt(target.level!.replace(/\D/g, ""), 10);
        return targetNum === currentNum + 1;
      });

      const fd = new FormData();
      fd.set("studentId", selectedStudent.id);
      fd.set("currentClassId", currentClass?.id ?? "");
      fd.set("requestedClassId", target.id);
      fd.set("tenantId", tenantId);
      await requestLevelUp(fd);

      pushMsg({
        role: "assistant",
        content: `Level up request submitted! ${config.directorName} and the teaching team will review and get back to you soon.`,
      });
    } catch {
      pushMsg({
        role: "assistant",
        content: "Sorry, there was an issue submitting the level up request. Please try again.",
      });
    }
  }

  // Step C: Quick confirm
  function handleQuickConfirm() {
    if (!selectedStudent || !selectedClass) return;
    addUserMessage("Confirmed!");

    if (savedCard) {
      // Already have payment on file — go to confirmation
      pushMsg({
        role: "assistant",
        content: `All set! ${selectedStudent.firstName} is enrolled. Welcome to ${selectedClass.name}!`,
      });
      pushMsg({ role: "card", content: "", cardType: "confirmation" });
      setStep(4);
    } else {
      // Need payment
      pushMsg({
        role: "assistant",
        content: "Last step — let's set up your payment method.",
      });
      // Create payment intent
      createPaymentIntent();
    }
  }

  async function createPaymentIntent() {
    if (!selectedClass) return;
    try {
      const res = await fetch("/api/enroll/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: selectedClass.price * 100,
          tenantId,
          metadata: {
            studentId: selectedStudent?.id,
            classId: selectedClass.id,
            type: "re-enrollment",
          },
        }),
      });
      const data = await res.json();
      setPaymentSecret(data.clientSecret);
      pushMsg({ role: "card", content: "", cardType: "payment" });
      setStep(3);
    } catch {
      pushMsg({
        role: "assistant",
        content: "There was an issue setting up payment. Please contact the studio.",
      });
    }
  }

  // Step D: Payment success
  function handlePaymentSuccess() {
    pushMsg({
      role: "assistant",
      content: `Payment received! ${selectedStudent?.firstName} is officially enrolled in ${selectedClass?.name}. ${config.directorName} and the team are excited to see them!`,
    });
    pushMsg({ role: "card", content: "", cardType: "confirmation" });
    setStep(4);
  }

  function handlePaymentError(msg: string) {
    pushMsg({
      role: "assistant",
      content: `Payment issue: ${msg}. Please try again or contact the studio.`,
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  function renderCard(msg: ChatMessage, idx: number) {
    switch (msg.cardType) {
      case "student-selection":
        return (
          <StudentSelectionCard
            key={idx}
            config={config}
            students={students}
            onSelect={handleStudentSelect}
            onAddNew={handleAddNewDancer}
          />
        );
      case "class-recommendation":
        return (
          <ClassRecommendationCard
            key={idx}
            config={config}
            classes={availableClasses}
            onSelect={handleClassSelect}
            onWaitlist={handleWaitlist}
          />
        );
      case "level-up":
        return levelUpOptions[0] && selectedStudent ? (
          <LevelUpCard
            key={idx}
            config={config}
            studentName={selectedStudent.firstName}
            currentLevel={selectedStudent.currentLevel ?? "Current"}
            nextLevel={levelUpOptions[0].level ?? "Next"}
            className={levelUpOptions[0].name}
            onRequest={handleLevelUpRequest}
          />
        ) : null;
      case "quick-confirm":
        return selectedStudent && selectedClass ? (
          <QuickConfirmCard
            key={idx}
            config={config}
            studentName={`${selectedStudent.firstName} ${selectedStudent.lastName}`}
            className={selectedClass.name}
            dayTime={selectedClass.dayTime}
            price={selectedClass.price}
            emergencyContactName="On file"
            savedCardLast4={savedCard}
            onConfirm={handleQuickConfirm}
          />
        ) : null;
      case "payment":
        return paymentSecret ? (
          <PaymentCard
            key={idx}
            config={config}
            clientSecret={paymentSecret}
            amount={selectedClass?.price ?? 0}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        ) : null;
      case "confirmation":
        return selectedStudent && selectedClass ? (
          <ConfirmationCard
            key={idx}
            config={config}
            studentName={selectedStudent.firstName}
            className={selectedClass.name}
            dayTime={selectedClass.dayTime}
            studioAddress={STUDIO_ADDRESS}
            studioName={studioName}
          />
        ) : null;
      default:
        return null;
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        {config.assistantAvatarUrl ? (
          <img
            src={config.assistantAvatarUrl}
            alt={config.assistantName}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div
            style={{ backgroundColor: config.primaryColor }}
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
          >
            {config.assistantName.charAt(0)}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-charcoal">
            {config.assistantName}
          </p>
          <p className="text-xs text-mist">{studioName} Enrollment</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.map((msg, idx) => {
          if (msg.role === "card") return renderCard(msg, idx);

          const isAssistant = msg.role === "assistant";
          return (
            <div
              key={idx}
              className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
            >
              <div
                style={
                  !isAssistant
                    ? { backgroundColor: config.primaryColor }
                    : undefined
                }
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  isAssistant
                    ? "bg-gray-100 text-charcoal"
                    : "text-white"
                }`}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
