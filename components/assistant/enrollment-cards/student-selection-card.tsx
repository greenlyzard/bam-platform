"use client";

import { useState } from "react";
import type { AssistantConfig } from "@/lib/assistant/config";

interface StudentOption {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  currentLevel: string | null;
  enrolledClasses: string[];
}

interface StudentSelectionCardProps {
  config: AssistantConfig;
  students: StudentOption[];
  onSelect: (studentId: string) => void;
  onAddNew: () => void;
}

function getInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function StudentSelectionCard({
  config,
  students,
  onSelect,
  onAddNew,
}: StudentSelectionCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const wrapperStyle = {
    "--assistant-color": config.primaryColor,
  } as React.CSSProperties;

  return (
    <div
      style={wrapperStyle}
      className="rounded-2xl border border-[var(--assistant-color)]/20 bg-white p-4 shadow-sm max-w-sm"
    >
      <h3 className="mb-3 text-sm font-bold text-charcoal">
        Who are we enrolling?
      </h3>

      <div className="grid gap-2">
        {students.map((student) => {
          const isSelected = selectedId === student.id;

          return (
            <button
              key={student.id}
              type="button"
              onClick={() => {
                setSelectedId(student.id);
                onSelect(student.id);
              }}
              style={
                isSelected
                  ? {
                      borderColor: config.primaryColor,
                      boxShadow: `0 0 0 2px ${config.primaryColor}40`,
                    }
                  : undefined
              }
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                isSelected
                  ? ""
                  : "border-silver hover:border-gray-300"
              }`}
            >
              {/* Avatar / Initials */}
              {student.avatarUrl ? (
                <img
                  src={student.avatarUrl}
                  alt={`${student.firstName} ${student.lastName}`}
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div
                  style={{
                    backgroundColor: `${config.primaryColor}1A`,
                    color: config.primaryColor,
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                >
                  {getInitials(student.firstName, student.lastName)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-charcoal">
                    {student.firstName} {student.lastName}
                  </span>
                  {student.currentLevel && (
                    <span
                      style={{
                        backgroundColor: `${config.primaryColor}1A`,
                        color: config.primaryColor,
                      }}
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    >
                      {student.currentLevel}
                    </span>
                  )}
                </div>
                {student.enrolledClasses.length > 0 && (
                  <p className="mt-0.5 truncate text-xs text-mist">
                    {student.enrolledClasses.join(", ")}
                  </p>
                )}
              </div>

              {/* Selection indicator */}
              <div
                style={
                  isSelected
                    ? { backgroundColor: config.primaryColor, borderColor: config.primaryColor }
                    : undefined
                }
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                  isSelected ? "" : "border-silver"
                }`}
              >
                {isSelected && (
                  <svg
                    className="h-3 w-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Add new dancer */}
      <button
        type="button"
        onClick={onAddNew}
        style={{ color: config.primaryColor }}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-silver py-2.5 text-sm font-medium transition hover:border-gray-400 hover:opacity-80"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add a New Dancer
      </button>
    </div>
  );
}
