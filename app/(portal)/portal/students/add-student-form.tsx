"use client";

import { useState } from "react";
import { SimpleSelect } from "@/components/ui/select";
import { addStudent } from "./actions";

export function AddDancerForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState("");
  const [currentLevel, setCurrentLevel] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const result = await addStudent(formData);
    setLoading(false);

    if (result?.error) {
      setError(result.error);
    } else {
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-silver bg-white p-6 text-center hover:border-lavender hover:bg-lavender/5 transition-colors group"
      >
        <span className="text-2xl text-mist group-hover:text-lavender">+</span>
        <p className="mt-1 text-sm font-medium text-slate group-hover:text-lavender-dark">
          Add a Student
        </p>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-silver bg-white p-6">
      <h3 className="font-heading text-lg font-semibold text-charcoal mb-4">
        Add a New Student
      </h3>

      {error && (
        <div className="mb-4 rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-charcoal mb-1.5"
            >
              First name *
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-base placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-charcoal mb-1.5"
            >
              Last name *
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              required
              className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-base placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="dateOfBirth"
              className="block text-sm font-medium text-charcoal mb-1.5"
            >
              Date of birth *
            </label>
            <input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              required
              className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-base placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="gender"
              className="block text-sm font-medium text-charcoal mb-1.5"
            >
              Gender{" "}
              <span className="text-mist font-normal">(optional)</span>
            </label>
            <input type="hidden" name="gender" value={gender} />
            <SimpleSelect
              value={gender}
              onValueChange={setGender}
              options={[
                { value: "female", label: "Female" },
                { value: "male", label: "Male" },
                { value: "other", label: "Other" },
              ]}
              placeholder="Prefer not to say"
              className="w-full"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="currentLevel"
            className="block text-sm font-medium text-charcoal mb-1.5"
          >
            Experience level
          </label>
          <input type="hidden" name="currentLevel" value={currentLevel} />
          <SimpleSelect
            value={currentLevel}
            onValueChange={setCurrentLevel}
            options={[
              { value: "pre_ballet", label: "New to ballet" },
              { value: "level_1", label: "Beginner (some experience)" },
              { value: "level_2", label: "Intermediate" },
              { value: "level_3", label: "Advanced" },
            ]}
            placeholder="Not sure yet"
            className="w-full"
          />
        </div>

        <div>
          <label
            htmlFor="medicalNotes"
            className="block text-sm font-medium text-charcoal mb-1.5"
          >
            Medical notes{" "}
            <span className="text-mist font-normal">(optional)</span>
          </label>
          <textarea
            id="medicalNotes"
            name="medicalNotes"
            rows={2}
            placeholder="Any medical information the studio should know..."
            className="w-full rounded-lg border border-silver bg-white px-4 py-3 text-base placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none resize-none"
          />
        </div>

        <div>
          <label
            htmlFor="allergyNotes"
            className="block text-sm font-medium text-charcoal mb-1.5"
          >
            Allergies{" "}
            <span className="text-mist font-normal">(optional)</span>
          </label>
          <textarea
            id="allergyNotes"
            name="allergyNotes"
            rows={2}
            placeholder="Any allergies or sensitivities..."
            className="w-full rounded-lg border border-silver bg-white px-4 py-3 text-base placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none resize-none"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate">
          <input
            type="checkbox"
            name="photoConsent"
            value="true"
            className="rounded border-silver"
          />
          I consent to photos and videos of my child being used for studio purposes
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add Student"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-11 rounded-lg border border-silver text-slate hover:text-charcoal font-medium text-sm px-6 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
