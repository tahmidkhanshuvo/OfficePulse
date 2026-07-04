import { useEffect, useMemo, useRef, useState } from "react";
import { sendAiMessage, withControlRetry } from "../lib/api";

type ChatRole = "user" | "bot";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  time: string;
};

// Web Speech API typings (not in default lib.dom in every TS setup)
type SpeechRecognitionLike = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
};

type SpeechRecognitionEventLike = {
  results: { [index: number]: { [index: number]: { transcript: string }; isFinal: boolean }; length: number };
};

type SpeechRecognitionErrorEventLike = { error?: string };

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const SUGGESTIONS = [
  "Which lights are on right now?",
  "Turn off Work Room 1",
  "Estimate monthly bill by room",
  "Any active alerts?",
  "What should I optimize next?",
];

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome",
      role: "bot",
      text: "Hi, I'm Pulse. Ask me anything or tap the mic to speak.",
      time: formatTime(new Date()),
    },
  ]);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const conversationIdRef = useRef(`chat_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Detect Speech Recognition support once on mount.
  useEffect(() => {
    setVoiceSupported(getSpeechRecognition() !== null);
  }, []);

  // Auto-scroll to the newest message when the panel is open.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messages]);

  // Clean up any active recognition on unmount.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = new Date();
    const userMsg: ChatMessage = {
      id: `u-${now.getTime()}`,
      role: "user",
      text: trimmed,
      time: formatTime(now),
    };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setThinking(true);
    try {
      const result = await withControlRetry(() => sendAiMessage(conversationIdRef.current, trimmed));
      const replyAt = new Date();
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${replyAt.getTime()}`,
          role: "bot",
          text: result.answer,
          time: formatTime(replyAt),
        },
      ]);
    } catch (cause) {
      const replyAt = new Date();
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${replyAt.getTime()}`,
          role: "bot",
          text: cause instanceof Error ? cause.message : "I could not reach the office control API.",
          time: formatTime(replyAt),
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendMessage(draft);
  };

  const startListening = () => {
    setVoiceError(null);
    const SR = getSpeechRecognition();
    if (!SR) {
      setVoiceSupported(false);
      setVoiceError("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    // If a session is already running, stop it cleanly before starting a new one.
    recognitionRef.current?.abort();
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator?.language || "en-US";

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) {
        setDraft(transcript);
        sendMessage(transcript);
      }
    };
    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      const code = event.error ?? "unknown";
      setVoiceError(`Mic error: ${code}. Try again or type your message.`);
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch (err) {
      setVoiceError("Could not start the microphone. Check browser permissions.");
      setListening(false);
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const hasMessages = useMemo(() => messages.length > 0, [messages]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 font-body-base">
      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Pulse voice assistant"
          className="w-[340px] sm:w-[380px] h-[520px] max-h-[80vh] bg-surface-panel backdrop-blur-[20px] border border-border-subtle rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-bg-deep/40">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#FF9D63]/15 border border-[#FF9D63]/30 flex items-center justify-center">
                <span className="material-symbols-outlined" style={{ color: "#FF9D63", fontSize: "20px" }}>
                  graphic_eq
                </span>
              </div>
              <div>
                <p className="font-headline-md text-headline-md text-text-primary leading-none">
                  Pulse
                </p>
                <p className="font-label-caps text-label-caps text-text-secondary uppercase mt-1">
                  Voice Assistant
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                close
              </span>
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 px-4 py-4 overflow-y-auto custom-scrollbar flex flex-col gap-3"
          >
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? "bg-[#FF9D63] text-black rounded-br-sm"
                        : "bg-white/5 border border-border-subtle text-text-primary rounded-bl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="font-label-caps text-label-caps text-text-secondary uppercase">
                    {msg.time}
                  </span>
                </div>
              );
            })}
            {!hasMessages && (
              <p className="text-text-secondary text-sm">Start the conversation...</p>
            )}
            {thinking && (
              <div className="flex flex-col gap-1 items-start">
                <div className="max-w-[85%] px-3 py-2 rounded-2xl text-sm bg-white/5 border border-border-subtle text-text-secondary rounded-bl-sm">
                  Thinking with live office data...
                </div>
              </div>
            )}
          </div>

          {/* Suggestions (only when the user hasn't typed yet) */}
          {draft.length === 0 && messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="text-xs px-2.5 py-1.5 rounded-full border border-border-subtle bg-white/5 hover:bg-white/10 text-text-secondary hover:text-text-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Voice error / capability notice */}
          {voiceError && (
            <p className="px-4 pb-1 text-xs text-[#FF9D63]">{voiceError}</p>
          )}

          {/* Composer */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-border-subtle bg-bg-deep/40 px-3 py-3 flex items-end gap-2"
          >
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              aria-label={listening ? "Stop listening" : "Start voice input"}
              aria-pressed={listening}
              title={
                voiceSupported
                  ? listening
                    ? "Stop listening"
                    : "Start voice input"
                  : "Voice input not supported"
              }
              className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center border transition-all ${
                listening
                  ? "bg-[#FF9D63] border-[#FF9D63] text-black shadow-[0_0_16px_rgba(255,157,99,0.55)] animate-pulse"
                  : voiceSupported
                    ? "bg-white/5 border-border-subtle hover:bg-white/10"
                    : "bg-white/5 border-border-subtle opacity-50 cursor-not-allowed"
              }`}
              disabled={!voiceSupported && !listening}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  color: listening ? "#000" : voiceSupported ? "#FF9D63" : "#888",
                  fontSize: "20px",
                }}
              >
                mic
              </span>
            </button>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(draft);
                }
              }}
              placeholder={listening ? "Listening..." : "Ask Pulse anything"}
              rows={1}
              className="flex-1 resize-none bg-transparent border border-border-subtle rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary placeholder:opacity-60 focus:outline-none focus:border-[#FF9D63]/60 custom-scrollbar"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={draft.trim().length === 0}
              className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center bg-[#FF9D63] text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#FFB07A] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ color: "#000", fontSize: "20px" }}>
                send
              </span>
            </button>
          </form>
        </div>
      )}

      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Pulse assistant" : "Open Pulse assistant"}
        aria-expanded={open}
        className={`h-14 w-14 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.5)] border transition-all ${
          open
            ? "bg-bg-deep border-border-subtle"
            : "bg-[#FF9D63] border-[#FF9D63] hover:bg-[#FFB07A] hover:scale-105"
        }`}
      >
        <span
          className="material-symbols-outlined"
          style={{
            color: open ? "#FF9D63" : "#000",
            fontSize: "26px",
          }}
        >
          {open ? "close" : "graphic_eq"}
        </span>
        {!open && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#FF9D63] border-2 border-[#0A0A0A] animate-pulse" />
        )}
      </button>
    </div>
  );
}

export default Chatbot;
