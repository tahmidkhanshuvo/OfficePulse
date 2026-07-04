import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ActivityItem } from "../../../../packages/contracts/src";
import { DashboardChrome } from "../components/DashboardChrome";
import { getActivity } from "../lib/api";

type LogsProps = {
  onExit?: () => void;
};

type LogCategory = "SYSTEM" | "USER" | "SCHEDULE" | "ALERT" | "SENSOR" | "MAINTENANCE";

type LogEntry = {
  id: string;
  time: string;
  message: ReactNode;
  category: LogCategory;
  /** Highlight as an alert row (tinted background + error color). */
  alert?: boolean;
};

const FILTERS: { id: "ALL" | LogCategory; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "SYSTEM", label: "System" },
  { id: "USER", label: "User" },
  { id: "SCHEDULE", label: "Schedule" },
  { id: "ALERT", label: "Alerts" },
];

const ENTRIES: LogEntry[] = [
  {
    id: "1",
    time: "10:42 AM",
    message: (
      <>
        Work Room 1: Light 1 turned{" "}
        <span className="text-text-secondary font-medium">ON</span>
      </>
    ),
    category: "USER",
  },
  {
    id: "2",
    time: "10:18 AM",
    message: (
      <>
        Work Room 1: Fan 1 turned{" "}
        <span className="text-text-secondary font-medium">OFF</span>
      </>
    ),
    category: "USER",
  },
  {
    id: "3",
    time: "09:47 AM",
    message: (
      <>
        Work Room 2: Light 3 turned{" "}
        <span className="text-text-secondary font-medium">ON</span>
      </>
    ),
    category: "USER",
  },
  {
    id: "4",
    time: "09:15 AM",
    message: (
      <>
        Drawing Room: Fan 2 turned{" "}
        <span className="text-text-secondary font-medium">OFF</span>
      </>
    ),
    category: "SYSTEM",
  },
  {
    id: "5",
    time: "08:52 AM",
    message: (
      <>
        Work Room 2: Fan 2 turned{" "}
        <span className="text-text-secondary font-medium">ON</span>
      </>
    ),
    category: "SCHEDULE",
  },
  {
    id: "6",
    time: "08:30 AM",
    message: (
      <>
        Drawing Room: Light 2 turned{" "}
        <span className="text-text-secondary font-medium">OFF</span>
      </>
    ),
    category: "SCHEDULE",
  },
  {
    id: "7",
    time: "08:05 AM",
    message: (
      <>
        Work Room 1: Light 1 turned{" "}
        <span className="text-text-secondary font-medium">ON</span>
      </>
    ),
    category: "SYSTEM",
  },
  {
    id: "8",
    time: "07:42 AM",
    message: (
      <>
        Drawing Room: Fan 1 turned{" "}
        <span className="text-text-secondary font-medium">ON</span>
      </>
    ),
    category: "SYSTEM",
  },
];

function categoryFromActivity(item: ActivityItem): LogCategory {
  if (item.type.includes("alert")) return "ALERT";
  if (item.type.includes("telemetry") || item.type.includes("occupancy")) return "SENSOR";
  if (item.type.includes("device")) return item.type.includes("api") ? "USER" : "SYSTEM";
  return "SYSTEM";
}

function formatActivityTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Logs({ onExit }: LogsProps) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("ALL");
  const [entries, setEntries] = useState<LogEntry[]>(ENTRIES);

  useEffect(() => {
    getActivity()
      .then((result) => {
        if (result.items.length === 0) return;
        setEntries(
          result.items
            .slice()
            .reverse()
            .map((item) => ({
              id: item.id,
              time: formatActivityTime(item.occurredAt),
              message: item.message,
              category: categoryFromActivity(item),
              alert: item.type.includes("alert"),
            })),
        );
      })
      .catch(() => setEntries(ENTRIES));
  }, []);

  const visible = useMemo(() => {
    if (filter === "ALL") return entries;
    return entries.filter((e) => e.category === filter);
  }, [entries, filter]);

  return (
    <DashboardChrome active="logs" onExit={onExit}>
      <main className="pt-20 md:pl-64 md:h-screen md:overflow-hidden flex flex-col">
        <div className="flex-1 md:min-h-0 p-4 md:p-8 flex flex-col gap-8 md:overflow-y-auto custom-scrollbar">
          {/* Header — matches Overview / Map / DeviceAnalytics */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-subtle pb-4 shrink-0">
            <div>
              <h1 className="font-headline-md text-headline-md text-text-primary">
                System Activity Log
              </h1>
              <p className="font-body-base text-body-base text-text-secondary mt-1">
                Real-time telemetry and event stream
              </p>
            </div>
            {/* Filter chips */}
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const isActive = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={
                      isActive
                        ? "px-3 py-1 rounded-full border border-[#FF9D63] bg-[#FF9D63]/10 text-[#FF9D63] font-label-caps text-label-caps uppercase transition-colors"
                        : f.id === "ALERT"
                          ? "px-3 py-1 rounded-full border border-border-subtle text-text-secondary hover:text-[#FF9D63] hover:border-[#FF9D63]/50 font-label-caps text-label-caps uppercase transition-colors"
                          : "px-3 py-1 rounded-full border border-border-subtle text-text-secondary hover:text-text-primary hover:border-text-primary/50 font-label-caps text-label-caps uppercase transition-colors"
                    }
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </header>

          {/* Feed */}
          <section className="flex-1 md:min-h-0 flex flex-col">
            <div className="bg-surface-panel border border-border-subtle rounded-xl flex flex-col overflow-hidden backdrop-blur-xl relative shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] md:flex-1 md:min-h-0">
              {/* Feed header */}
              <div className="px-4 md:px-6 py-4 border-b border-border-subtle flex items-center gap-3 bg-black/20 shrink-0">
                <span className="material-symbols-outlined">history</span>
                <h3 className="font-label-caps text-label-caps text-text-primary uppercase">
                  Recent Activity Feed
                </h3>
                <div className="ml-auto flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF9D63] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF9D63]" />
                  </span>
                  <span className="font-label-caps text-label-caps text-text-secondary uppercase">
                    LIVE
                  </span>
                </div>
              </div>

              {/* Log entries */}
              <div className="flex-1 md:min-h-0 md:overflow-y-auto custom-scrollbar px-4 py-2 space-y-1">
                {visible.map((entry) => (
                  <div
                    key={entry.id}
                    className={
                      entry.alert
                        ? "group flex items-start sm:items-center py-3 rounded px-2 -mx-2 bg-[#FF9D63]/10 border border-[#FF9D63]/30 hover:bg-[#FF9D63]/15 transition-colors"
                        : "group flex items-start sm:items-center py-3 hover:bg-white/[0.02] transition-colors rounded px-2 -mx-2"
                    }
                  >
                    <div className="flex items-center shrink-0 w-24">
                      <span
                        className={
                          entry.alert
                            ? "font-label-caps text-label-caps text-[#FF9D63] tabular-nums"
                            : "font-label-caps text-label-caps text-text-secondary tabular-nums"
                        }
                      >
                        {entry.time}
                      </span>
                    </div>
                    <div
                      className={
                        entry.alert
                          ? "w-px h-6 bg-[#FF9D63]/30 mx-4 shrink-0 hidden sm:block"
                          : "w-px h-6 bg-border-subtle mx-4 shrink-0 hidden sm:block group-hover:bg-[#FF9D63]/50 transition-colors"
                      }
                    />
                    <div
                      className={
                        entry.alert
                          ? "flex-1 font-body-base text-body-base text-text-primary pr-4 break-words flex items-center gap-2"
                          : "flex-1 font-body-base text-body-base text-text-primary pr-4 break-words"
                      }
                    >
                      {entry.alert && (
                        <span className="material-symbols-outlined text-[16px] shrink-0 text-[#FF9D63]">
                          warning
                        </span>
                      )}
                      {entry.message}
                    </div>
                    <div className="shrink-0 mt-2 sm:mt-0">
                      <span
                        className={
                          entry.alert
                            ? "inline-block px-2 py-1 rounded border border-[#FF9D63]/40 font-label-caps text-label-caps text-[#FF9D63] tracking-wider uppercase bg-black/40"
                            : "inline-block px-2 py-1 rounded border border-border-subtle font-label-caps text-label-caps text-[#FF9D63] tracking-wider uppercase bg-black/40"
                        }
                      >
                        {entry.category}
                      </span>
                    </div>
                  </div>
                ))}

                {visible.length === 0 && (
                  <div className="py-12 text-center font-body-sm text-body-sm text-text-secondary">
                    No events match this filter.
                  </div>
                )}
              </div>

              {/* Bottom fade */}
              <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-[#131313] to-transparent pointer-events-none rounded-b-xl" />
            </div>
          </section>
        </div>
      </main>
    </DashboardChrome>
  );
}

export default Logs;
