"use client";

import { useState, useMemo } from "react";
import { Loader2, Send, Mail, Clock, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TicketHub } from "./use-ticket-hub";

interface NoteData {
  id: string;
  text: string;
  createdBy?: string;
  createdAt: Date;
  internal: boolean;
  noteType?: string;
}

type NoteTab = "internal" | "discussion" | "all";

interface TicketNotesThreadProps {
  ticketId: string;
  notes?: NoteData[];
  isLoading: boolean;
  hub: TicketHub;
  contactName?: string;
  contactEmail?: string;
  resourceNames?: string[];
  /** Existing CC emails from ticket (comma-separated string from CW automaticEmailCc) */
  existingCcEmails?: string;
}

export function TicketNotesThread({ ticketId, notes, isLoading, hub, contactName, contactEmail, resourceNames, existingCcEmails }: TicketNotesThreadProps) {
  const [noteText, setNoteText] = useState("");
  const [internal, setInternal] = useState(true);
  const [emailContact, setEmailContact] = useState(false);
  const [emailResources, setEmailResources] = useState(false);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState("");

  // Parse existing CC emails from ticket
  const parsedExistingCc = useMemo(() => {
    if (!existingCcEmails) return [];
    return existingCcEmails.split(",").map((e) => e.trim()).filter((e) => e && e.includes("@"));
  }, [existingCcEmails]);
  const [timeHours, setTimeHours] = useState("");
  const [showTimeOnNote, setShowTimeOnNote] = useState(false);
  const [activeTab, setActiveTab] = useState<NoteTab>("all");

  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    if (activeTab === "all") return notes;
    if (activeTab === "internal") return notes.filter((n) => n.internal);
    return notes.filter((n) => !n.internal);
  }, [notes, activeTab]);

  const counts = useMemo(() => {
    if (!notes) return { all: 0, internal: 0, discussion: 0 };
    return {
      all: notes.length,
      internal: notes.filter((n) => n.internal).length,
      discussion: notes.filter((n) => !n.internal).length,
    };
  }, [notes]);

  function submit() {
    if (!noteText.trim()) return;
    const hours = showTimeOnNote && timeHours ? parseFloat(timeHours) : undefined;
    hub.addNote.mutate(
      {
        ticketId,
        text: noteText.trim(),
        internal,
        emailContact: !internal ? emailContact : undefined,
        emailResources: !internal ? emailResources : undefined,
        emailCc: !internal && ccEmails.length > 0 ? ccEmails.join(",") : undefined,
        timeHours: hours && hours > 0 ? hours : undefined,
      },
      {
        onSuccess: () => {
          setNoteText("");
          setTimeHours("");
          setShowTimeOnNote(false);
          setEmailContact(false);
          setEmailResources(false);
          setCcEmails([]);
          setCcInput("");
        },
      }
    );
  }

  const TABS: { id: NoteTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "internal", label: "Internal", count: counts.internal },
    { id: "discussion", label: "Discussion", count: counts.discussion },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-4 border-b border-border/30">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition-colors -mb-px",
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                activeTab === tab.id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notes list */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading notes...
        </div>
      ) : filteredNotes.length > 0 ? (
        <div className="space-y-2.5 max-h-96 overflow-y-auto mb-4 pr-1">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className={cn(
                "rounded-lg border p-3.5 text-xs",
                note.internal
                  ? "border-yellow-500/20 bg-yellow-500/5"
                  : "border-blue-500/20 bg-blue-500/5"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground/90">
                    {note.createdBy ?? "Unknown"}
                  </span>
                  <span className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                    note.internal
                      ? "bg-yellow-500/15 text-yellow-500"
                      : "bg-blue-500/15 text-blue-500"
                  )}>
                    {note.internal ? "Internal" : "Discussion"}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">{hub.relative(note.createdAt)}</span>
              </div>
              <p className="text-foreground/80 whitespace-pre-wrap leading-relaxed">{note.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mb-4 py-4 text-center">
          {activeTab === "all" ? "No notes yet" : `No ${activeTab} notes`}
        </p>
      )}

      {/* Add Note form */}
      <div className="space-y-2.5 rounded-lg border border-border/30 bg-muted/5 p-4">
        <textarea
          placeholder="Add a note..."
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          className="w-full h-24 rounded-md border border-border bg-background px-3 py-2.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(); }}
        />

        {/* Note options row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {/* Internal / Discussion toggle */}
            <div className="flex rounded-md border border-border/50 overflow-hidden">
              <button
                onClick={() => { setInternal(true); setEmailContact(false); setEmailResources(false); setCcEmails([]); setCcInput(""); }}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-medium transition-colors",
                  internal
                    ? "bg-yellow-500/15 text-yellow-500"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Internal
              </button>
              <button
                onClick={() => setInternal(false)}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-medium transition-colors border-l border-border/50",
                  !internal
                    ? "bg-blue-500/15 text-blue-500"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Discussion
              </button>
            </div>

            {/* Email checkboxes (only for discussion notes) */}
            {!internal && (contactName || contactEmail) && (
              <label className="flex items-center gap-1.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={emailContact}
                  onChange={(e) => setEmailContact(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-green-500"
                />
                <Mail className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                <span className="text-[10px] text-muted-foreground group-hover:text-foreground">
                  Email {contactName ?? "Contact"}
                  {contactEmail && <span className="text-muted-foreground/50 ml-1">({contactEmail})</span>}
                </span>
              </label>
            )}
            {/* Email Resources checkbox (only for discussion notes) */}
            {!internal && resourceNames && resourceNames.length > 0 && (
              <label className="flex items-center gap-1.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={emailResources}
                  onChange={(e) => setEmailResources(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-purple-500"
                />
                <Users className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                <span className="text-[10px] text-muted-foreground group-hover:text-foreground">
                  Email Resources
                  <span className="text-muted-foreground/50 ml-1">({resourceNames.join(", ")})</span>
                </span>
              </label>
            )}

            {/* Cc email section (only for discussion notes) */}
            {!internal && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="text-[10px] text-muted-foreground flex-shrink-0">Cc:</span>
                {/* Existing CC contacts from ticket — click to toggle */}
                {parsedExistingCc.map((email) => {
                  const isSelected = ccEmails.includes(email);
                  return (
                    <button
                      key={`existing-${email}`}
                      onClick={() => {
                        if (isSelected) setCcEmails(ccEmails.filter((e) => e !== email));
                        else setCcEmails([...ccEmails, email]);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                        isSelected
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "bg-muted/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                      )}
                    >
                      {email}
                    </button>
                  );
                })}
                {/* Manually added CC emails */}
                {ccEmails.filter((e) => !parsedExistingCc.includes(e)).map((email) => (
                  <span key={email} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary">
                    {email}
                    <button onClick={() => setCcEmails(ccEmails.filter((e) => e !== email))} className="text-primary/60 hover:text-primary">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  type="email"
                  placeholder="Add email..."
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === "," || e.key === "Tab") && ccInput.trim()) {
                      e.preventDefault();
                      const email = ccInput.trim().replace(/,$/,"");
                      if (email && email.includes("@") && !ccEmails.includes(email)) {
                        setCcEmails([...ccEmails, email]);
                      }
                      setCcInput("");
                    }
                  }}
                  onBlur={() => {
                    const email = ccInput.trim().replace(/,$/,"");
                    if (email && email.includes("@") && !ccEmails.includes(email)) {
                      setCcEmails([...ccEmails, email]);
                    }
                    setCcInput("");
                  }}
                  className="w-32 h-6 rounded border border-border/50 bg-background px-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            {/* Time on note toggle */}
            <button
              onClick={() => setShowTimeOnNote(!showTimeOnNote)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-medium border transition-colors",
                showTimeOnNote
                  ? "border-primary/30 text-primary bg-primary/10"
                  : "border-border/50 text-muted-foreground hover:text-foreground"
              )}
              title="Log time with this note"
            >
              <Clock className="h-3 w-3" />
              Add time
            </button>
          </div>

          {/* Submit */}
          <button
            onClick={submit}
            disabled={hub.addNote.isPending || !noteText.trim()}
            className="flex items-center gap-1.5 h-8 px-4 rounded-md text-xs font-medium bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-primary/90"
          >
            {hub.addNote.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Post Note
          </button>
        </div>

        {/* Time entry row (conditional) */}
        {showTimeOnNote && (
          <div className="flex items-center gap-2 pt-1">
            <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <input
              type="number"
              placeholder="Hours"
              value={timeHours}
              onChange={(e) => setTimeHours(e.target.value)}
              className="w-20 h-7 rounded-md border border-border bg-background px-2 text-xs"
              min="0.01"
              max="24"
              step="0.25"
            />
            <span className="text-[10px] text-muted-foreground">hours will be logged with this note</span>
          </div>
        )}
      </div>
    </div>
  );
}
