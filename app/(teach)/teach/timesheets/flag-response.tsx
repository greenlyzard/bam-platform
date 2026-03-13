"use client";

import { useState } from "react";
import { respondToFlag } from "./actions";

export function FlagResponseForm({ entryId }: { entryId: string }) {
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="text-sm text-success font-medium">
        Response submitted. Thank you!
      </div>
    );
  }

  return (
    <form
      action={async (fd) => {
        setLoading(true);
        setError("");
        const result = await respondToFlag(fd);
        setLoading(false);
        if (result?.error) setError(result.error);
        else setSubmitted(true);
      }}
      className="space-y-2"
    >
      <input type="hidden" name="entryId" value={entryId} />
      <textarea
        name="response"
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Type your response..."
        rows={2}
        required
        className="w-full rounded-lg border border-silver bg-white px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-2 focus:ring-lavender/20 focus:outline-none resize-none"
      />
      {error && (
        <p className="text-xs text-error">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading || !response.trim()}
        className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white font-semibold text-sm px-5 transition-colors disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Submit Response"}
      </button>
    </form>
  );
}
