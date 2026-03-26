"use client";

import { useState } from "react";

interface ClassOption {
  id: string;
  name: string;
  description: string;
  dayTime: string;
  ageRange: string;
  spotsRemaining: number;
  price: number;
  isFull: boolean;
}

interface ClassRecommendationCardProps {
  classes: ClassOption[];
  onSelect: (classId: string, time: string) => void;
  onWaitlist: (classId: string) => void;
}

const cardWrapper =
  "rounded-2xl border border-lavender/20 bg-white p-4 shadow-sm max-w-sm";

export function ClassRecommendationCard({
  classes,
  onSelect,
  onWaitlist,
}: ClassRecommendationCardProps) {
  const [selectedTime, setSelectedTime] = useState<Record<string, string>>({});

  if (!classes.length) {
    return (
      <div className={cardWrapper}>
        <p className="text-sm text-mist">
          No classes available at this time. Please contact us for more options.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {classes.map((cls) => {
        const times = cls.dayTime.split(",").map((t) => t.trim());
        const selected = selectedTime[cls.id];

        return (
          <div key={cls.id} className={cardWrapper}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold text-charcoal">{cls.name}</h3>
              <span className="shrink-0 rounded-full bg-lavender/10 px-2 py-0.5 text-xs font-medium text-lavender">
                {cls.ageRange}
              </span>
            </div>

            <p className="mb-2 line-clamp-2 text-xs text-mist">
              {cls.description}
            </p>

            {/* Time chips */}
            <div className="mb-2 flex flex-wrap gap-1">
              {times.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() =>
                    setSelectedTime((prev) => ({ ...prev, [cls.id]: time }))
                  }
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    selected === time
                      ? "bg-lavender text-white"
                      : "border border-silver text-charcoal hover:border-lavender"
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>

            {/* Spots + price */}
            <div className="mb-3 flex items-center justify-between text-xs">
              {cls.isFull ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-600">
                  WAITLIST
                </span>
              ) : (
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    cls.spotsRemaining <= 3
                      ? "bg-amber-100 text-amber-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {cls.spotsRemaining} spot{cls.spotsRemaining !== 1 ? "s" : ""}{" "}
                  left
                </span>
              )}
              <span className="font-medium text-charcoal">
                ${cls.price}/mo
              </span>
            </div>

            {cls.isFull ? (
              <button
                type="button"
                onClick={() => onWaitlist(cls.id)}
                className="h-9 w-full rounded-lg border border-lavender text-sm font-medium text-lavender transition hover:bg-lavender/5"
              >
                Join Waitlist
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSelect(cls.id, selected || times[0])}
                disabled={!selected && times.length > 1}
                className="h-9 w-full rounded-lg bg-lavender text-sm font-medium text-white transition hover:bg-dark-lavender disabled:opacity-50"
              >
                Select This Class
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
