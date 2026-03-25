"use client";

import { useState } from "react";
import { logHours } from "./actions";
import { SimpleSelect } from "@/components/ui/select";

interface LogHoursFormProps {
  classes: { id: string; name: string }[];
}

export function LogHoursForm({ classes }: LogHoursFormProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("class");
  const [classId, setClassId] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const result = await logHours(formData);
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
        className="w-full rounded-xl border-2 border-dashed border-silver bg-white p-5 text-center hover:border-lavender hover:bg-lavender/5 transition-colors group"
      >
        <span className="text-2xl text-mist group-hover:text-lavender">+</span>
        <p className="mt-1 text-sm font-medium text-slate group-hover:text-lavender-dark">
          Log Hours
        </p>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-silver bg-white p-6">
      <h3 className="font-heading text-lg font-semibold text-charcoal mb-4">
        Log Hours
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
              htmlFor="date"
              className="block text-sm font-medium text-charcoal mb-1.5"
            >
              Date *
            </label>
            <input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
              className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-base text-charcoal focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="hours"
              className="block text-sm font-medium text-charcoal mb-1.5"
            >
              Hours *
            </label>
            <input
              id="hours"
              name="hours"
              type="number"
              step="0.25"
              min="0.25"
              max="24"
              required
              placeholder="1.5"
              className="w-full h-11 rounded-lg border border-silver bg-white px-4 text-base text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="category"
            className="block text-sm font-medium text-charcoal mb-1.5"
          >
            Category *
          </label>
          <input type="hidden" name="category" value={category} />
          <SimpleSelect
            value={category}
            onValueChange={setCategory}
            options={[
              { value: "class", label: "Class" },
              { value: "private", label: "Private Lesson" },
              { value: "rehearsal", label: "Rehearsal" },
              { value: "admin", label: "Admin" },
              { value: "sub", label: "Substitute" },
            ]}
            className="w-full"
          />
        </div>

        <div>
          <label
            htmlFor="classId"
            className="block text-sm font-medium text-charcoal mb-1.5"
          >
            Class{" "}
            <span className="text-mist font-normal">(optional)</span>
          </label>
          <input type="hidden" name="classId" value={classId} />
          <SimpleSelect
            value={classId}
            onValueChange={setClassId}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="No specific class"
            className="w-full"
          />
        </div>

        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-charcoal mb-1.5"
          >
            Notes{" "}
            <span className="text-mist font-normal">(optional)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            placeholder="What did you work on?"
            className="w-full rounded-lg border border-silver bg-white px-4 py-3 text-base placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-6 transition-colors disabled:opacity-50"
          >
            {loading ? "Saving..." : "Log Hours"}
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
