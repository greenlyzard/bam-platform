interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  icon = "◇",
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <span className="text-4xl text-mist mb-4">{icon}</span>
      <h3 className="font-heading text-xl font-semibold text-charcoal">
        {title}
      </h3>
      <p className="mt-2 text-sm text-slate max-w-sm">{description}</p>
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-lavender px-5 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors"
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}
