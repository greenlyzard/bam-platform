"use client";

import { useState } from "react";
import { SimpleSelect } from "@/components/ui/select";

interface Rental {
  id: string;
  room_id: string;
  renter_name: string;
  renter_email: string;
  renter_phone: string | null;
  renter_type: string | null;
  start_time: string;
  end_time: string;
  rate_per_hour: number | null;
  total_amount: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface Room {
  id: string;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  inquiry: "bg-info/10 text-info",
  confirmed: "bg-success/10 text-success",
  cancelled: "bg-error/10 text-error",
  completed: "bg-cloud text-slate",
};

export function RentalsList({
  rentals: initial,
  rooms,
  roomNames,
}: {
  rentals: Rental[];
  rooms: Room[];
  roomNames: Record<string, string>;
}) {
  const [rentals, setRentals] = useState(initial);
  const [filter, setFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formRoomId, setFormRoomId] = useState("");
  const [formRenterType, setFormRenterType] = useState("");

  const filtered =
    filter === "all" ? rentals : rentals.filter((r) => r.status === filter);

  async function handleStatusChange(id: string, newStatus: string) {
    const res = await fetch(`/api/admin/rentals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setRentals((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const body = {
      room_id: formData.get("room_id"),
      renter_name: formData.get("renter_name"),
      renter_email: formData.get("renter_email"),
      renter_phone: formData.get("renter_phone") || null,
      renter_type: formData.get("renter_type") || null,
      start_time: formData.get("start_time"),
      end_time: formData.get("end_time"),
      rate_per_hour: formData.get("rate_per_hour")
        ? Number(formData.get("rate_per_hour"))
        : null,
      notes: formData.get("notes") || null,
    };

    const res = await fetch("/api/admin/rentals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const { data } = await res.json();
      setRentals((prev) => [data, ...prev]);
      setShowForm(false);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          {["all", "inquiry", "confirmed", "completed", "cancelled"].map(
            (s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === s
                    ? "bg-lavender text-white"
                    : "bg-cloud text-slate hover:bg-silver"
                }`}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            )
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-lavender px-4 py-2 text-sm font-medium text-white hover:bg-lavender-dark transition-colors"
        >
          {showForm ? "Cancel" : "New Rental"}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-silver bg-white p-5 space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate mb-1">
                Room
              </label>
              <input type="hidden" name="room_id" value={formRoomId} />
              <SimpleSelect
                value={formRoomId}
                onValueChange={setFormRoomId}
                options={rooms.map((r) => ({ value: r.id, label: r.name }))}
                placeholder="Select room..."
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">
                Renter Type
              </label>
              <input type="hidden" name="renter_type" value={formRenterType} />
              <SimpleSelect
                value={formRenterType}
                onValueChange={setFormRenterType}
                options={[
                  { value: "yoga", label: "Yoga" },
                  { value: "pilates", label: "Pilates" },
                  { value: "fitness", label: "Fitness" },
                  { value: "dance", label: "Dance" },
                  { value: "therapy", label: "Therapy" },
                  { value: "other", label: "Other" },
                ]}
                placeholder="Select type..."
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">
                Renter Name
              </label>
              <input
                name="renter_name"
                required
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">
                Renter Email
              </label>
              <input
                name="renter_email"
                type="email"
                required
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">
                Phone
              </label>
              <input
                name="renter_phone"
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">
                Rate ($/hr)
              </label>
              <input
                name="rate_per_hour"
                type="number"
                step="0.01"
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">
                Start Time
              </label>
              <input
                name="start_time"
                type="datetime-local"
                required
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">
                End Time
              </label>
              <input
                name="end_time"
                type="datetime-local"
                required
                className="w-full rounded-lg border border-silver px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              rows={2}
              className="w-full rounded-lg border border-silver px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-lavender px-4 py-2 text-sm font-medium text-white hover:bg-lavender-dark transition-colors disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Rental"}
          </button>
        </form>
      )}

      {/* Rentals List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white p-6 text-center text-sm text-mist">
          No rentals found.
        </div>
      ) : (
        <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
          {filtered.map((rental) => (
            <div key={rental.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-charcoal">
                      {rental.renter_name}
                    </h4>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[rental.status] ?? "bg-cloud text-slate"
                      }`}
                    >
                      {rental.status}
                    </span>
                    {rental.renter_type && (
                      <span className="inline-flex items-center rounded-full bg-cloud px-2 py-0.5 text-xs font-medium text-slate">
                        {rental.renter_type}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate">
                    {roomNames[rental.room_id] ?? "Unknown Room"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate">
                    <span>
                      {new Date(rental.start_time).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      {new Date(rental.start_time).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {" — "}
                      {new Date(rental.end_time).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    {rental.rate_per_hour != null && (
                      <span>${rental.rate_per_hour}/hr</span>
                    )}
                    {rental.total_amount != null && (
                      <span className="font-medium">
                        Total: ${rental.total_amount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate mt-0.5">
                    {rental.renter_email}
                    {rental.renter_phone ? ` | ${rental.renter_phone}` : ""}
                  </p>
                  {rental.notes && (
                    <p className="text-xs text-mist mt-1 italic">
                      {rental.notes}
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex gap-1">
                  {rental.status === "inquiry" && (
                    <button
                      onClick={() =>
                        handleStatusChange(rental.id, "confirmed")
                      }
                      className="rounded-lg bg-success/10 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/20 transition-colors"
                    >
                      Confirm
                    </button>
                  )}
                  {rental.status === "confirmed" && (
                    <button
                      onClick={() =>
                        handleStatusChange(rental.id, "completed")
                      }
                      className="rounded-lg bg-cloud px-3 py-1.5 text-xs font-medium text-slate hover:bg-silver transition-colors"
                    >
                      Complete
                    </button>
                  )}
                  {["inquiry", "confirmed"].includes(rental.status) && (
                    <button
                      onClick={() =>
                        handleStatusChange(rental.id, "cancelled")
                      }
                      className="rounded-lg bg-error/10 px-3 py-1.5 text-xs font-medium text-error hover:bg-error/20 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
