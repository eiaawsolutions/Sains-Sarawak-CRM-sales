import Link from "next/link";
import * as React from "react";

/**
 * SAINS CRM — UI primitives.
 *
 * Server-safe (no "use client"). Compose, don't abstract. Every variant is a
 * class-string branch — no cva, no emotion, no styled-components. Keep the
 * surface area small so the design system stays legible.
 */

// ---- cn -----------------------------------------------------------
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// ---- Button / ButtonLink -----------------------------------------
type ButtonSize = "sm" | "md" | "lg";
type ButtonTone = "primary" | "secondary" | "ghost" | "danger" | "subtle";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-sains ease-sains disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2";

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

const BTN_TONE: Record<ButtonTone, string> = {
  primary:   "bg-accent text-white hover:bg-accent-deep shadow-ink-1",
  secondary: "border border-hairline2 bg-white text-ink hover:bg-paper-2",
  ghost:     "text-ink-soft hover:text-ink hover:bg-paper-2",
  subtle:    "bg-paper-3 text-ink hover:bg-paper-2 border border-hairline",
  danger:    "bg-rose text-white hover:bg-rose-soft shadow-ink-1",
};

export function Button({
  tone = "primary", size = "md", className, children, ...rest
}: {
  tone?: ButtonTone;
  size?: ButtonSize;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cn(BTN_BASE, BTN_SIZE[size], BTN_TONE[tone], className)}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  tone = "primary", size = "md", className, href, children, ...rest
}: {
  tone?: ButtonTone;
  size?: ButtonSize;
  href: string;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link
      href={href}
      {...rest}
      className={cn(BTN_BASE, BTN_SIZE[size], BTN_TONE[tone], className)}
    >
      {children}
    </Link>
  );
}

// ---- Input / Select / Textarea -----------------------------------
const FIELD_BASE =
  "block w-full rounded-md border border-hairline2 bg-white text-sm text-ink placeholder:text-ink-faint " +
  "transition-colors duration-sains ease-sains " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 " +
  "disabled:bg-paper-3 disabled:text-ink-soft disabled:cursor-not-allowed";

export function Input(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return (
    <input
      {...props}
      className={cn(FIELD_BASE, "h-10 px-3", props.className)}
    />
  );
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement>
) {
  return (
    <select
      {...props}
      className={cn(FIELD_BASE, "h-10 px-3 pr-8 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%23475569%22%3E%3Cpath%20d%3D%22M5.5%208L10%2012.5%2014.5%208z%22%2F%3E%3C%2Fsvg%3E')] bg-[right_0.5rem_center] bg-no-repeat bg-[length:1.25rem]", props.className)}
    />
  );
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      className={cn(FIELD_BASE, "px-3 py-2 min-h-[80px]", props.className)}
    />
  );
}

// ---- Field (label + hint + error) --------------------------------
export function Field({
  label, hint, error, htmlFor, required, children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-medium text-ink-soft">
          {label}
          {required && <span className="ml-0.5 text-rose">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-[11px] text-ink-faint">{hint}</p>}
      {error && <p className="text-[11px] text-rose" role="alert">{error}</p>}
    </div>
  );
}

// ---- Badge (status chip) -----------------------------------------
type BadgeTone =
  | "neutral" | "accent" | "teal" | "gold" | "rose" | "ink";

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "text-ink-soft bg-paper-3 border-hairline",
  accent:  "text-accent-deep bg-accent-faint border-accent/20",
  teal:    "text-teal bg-teal-faint border-teal/20",
  gold:    "text-gold bg-gold-faint border-gold/25",
  rose:    "text-rose bg-rose-faint border-rose/25",
  ink:     "text-white bg-ink border-ink",
};

export function Badge({
  tone = "neutral", children, dot = false, className,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const dotColor: Record<BadgeTone, string> = {
    neutral: "bg-ink-faint",
    accent:  "bg-accent",
    teal:    "bg-teal",
    gold:    "bg-gold",
    rose:    "bg-rose",
    ink:     "bg-white",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-[11px] font-medium",
        BADGE_TONE[tone],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[tone])} />}
      {children}
    </span>
  );
}

// ---- Card --------------------------------------------------------
export function Card({
  className, children, padded = true,
}: {
  className?: string;
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-hairline bg-white shadow-ink-1",
        padded && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title, subtitle, actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---- Alert -------------------------------------------------------
type AlertTone = "info" | "success" | "warning" | "error";

const ALERT_TONE: Record<AlertTone, { wrap: string; icon: React.ReactNode; title: string }> = {
  info: {
    wrap: "border-accent/20 bg-accent-faint text-accent-deep",
    title: "text-accent-deep",
    icon: <IconInfo />,
  },
  success: {
    wrap: "border-teal/20 bg-teal-faint text-teal",
    title: "text-teal",
    icon: <IconCheck />,
  },
  warning: {
    wrap: "border-gold/25 bg-gold-faint text-gold",
    title: "text-gold",
    icon: <IconWarn />,
  },
  error: {
    wrap: "border-rose/25 bg-rose-faint text-rose",
    title: "text-rose",
    icon: <IconError />,
  },
};

export function Alert({
  tone = "info", title, children, className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = ALERT_TONE[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-md border px-4 py-3 text-sm",
        t.wrap,
        className,
      )}
    >
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div className="flex-1">
        {title && <div className={cn("font-semibold", t.title)}>{title}</div>}
        {children && <div className={cn("text-ink", title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}

// ---- PageHeader --------------------------------------------------
export function PageHeader({
  title, description, breadcrumbs, actions,
}: {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 border-b border-hairline pb-5">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex items-center gap-1.5 text-xs text-ink-faint">
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span aria-hidden>/</span>}
              {b.href ? (
                <Link href={b.href} className="hover:text-ink-soft transition-colors">{b.label}</Link>
              ) : (
                <span className="text-ink-soft">{b.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

// ---- Empty state -------------------------------------------------
export function EmptyState({
  title, description, action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-hairline2 bg-paper-2 px-6 py-16 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white text-ink-faint">
        <IconEmpty />
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-xs text-ink-soft">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---- Divider -----------------------------------------------------
export function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="my-4 border-hairline" />;
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-hairline" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{label}</span>
      <span className="h-px flex-1 bg-hairline" />
    </div>
  );
}

// ---- KPI tile ----------------------------------------------------
export function Kpi({
  label, value, hint, tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "neutral" | "accent" | "teal" | "gold" | "rose";
}) {
  const accent: Record<NonNullable<typeof tone>, string> = {
    neutral: "text-ink",
    accent:  "text-accent-deep",
    teal:    "text-teal",
    gold:    "text-gold",
    rose:    "text-rose",
  };
  return (
    <div className="rounded-card border border-hairline bg-white p-5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums", accent[tone])}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-ink-soft">{hint}</div>}
    </div>
  );
}

// ---- Icons (inline, stroke-only, 16px default) -------------------
type IconProps = { className?: string };
function IconInfo({ className }: IconProps = {}) {
  return (
    <svg className={cn("h-4 w-4", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
    </svg>
  );
}
function IconCheck({ className }: IconProps = {}) {
  return (
    <svg className={cn("h-4 w-4", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function IconWarn({ className }: IconProps = {}) {
  return (
    <svg className={cn("h-4 w-4", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
    </svg>
  );
}
function IconError({ className }: IconProps = {}) {
  return (
    <svg className={cn("h-4 w-4", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
    </svg>
  );
}
function IconEmpty({ className }: IconProps = {}) {
  return (
    <svg className={cn("h-5 w-5", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" />
    </svg>
  );
}
