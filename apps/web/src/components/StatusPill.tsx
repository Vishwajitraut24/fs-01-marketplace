import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";

interface StatusPillProps {
  status: "loading" | "up" | "down";
}

export function StatusPill({ status }: StatusPillProps) {
  const styles = {
    loading: "bg-slate-100 text-slate-600",
    up: "bg-emerald-50 text-emerald-700",
    down: "bg-amber-50 text-amber-800"
  }[status];
  const label = { loading: "Checking", up: "Connected", down: "Unavailable" }[status];
  const Icon = { loading: LoaderCircle, up: CheckCircle2, down: CircleAlert }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>
      <Icon className={`h-3.5 w-3.5 ${status === "loading" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}
