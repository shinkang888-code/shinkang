import { clsx } from "clsx";

type Variant = "active" | "suspended" | "role" | "default";

const MAP: Record<Variant, string> = {
  active:    "badge-active",
  suspended: "badge-suspended",
  role:      "badge-role",
  default:   "inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return <span className={clsx(MAP[variant], className)}>{children}</span>;
}
