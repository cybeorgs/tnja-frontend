import { Clock } from "lucide-react";

export function ExpiredBlock({ label }: { label: string }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm py-20 text-center space-y-3">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
        <Clock size={32} className="text-slate-400" />
      </div>
      <p className="text-slate-700 font-black text-lg">{label} Unavailable</p>
      <p className="text-slate-400 font-semibold text-sm max-w-sm mx-auto">
        This tournament has expired. {label} is only available for active and upcoming tournaments.
      </p>
    </div>
  );
}
