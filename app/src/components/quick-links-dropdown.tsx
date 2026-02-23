"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, ExternalLink, Settings2, FolderClosed, FolderOpen, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";

function Favicon({ url, size = 16 }: { url: string; size?: number }) {
  const [errored, setErrored] = useState(false);

  let domain = "";
  try {
    domain = new URL(url).hostname;
  } catch {
    return <ExternalLink style={{ width: size, height: size }} className="text-muted-foreground flex-shrink-0" />;
  }

  if (errored) {
    return <ExternalLink style={{ width: size, height: size }} className="text-muted-foreground flex-shrink-0" />;
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${size * 2}`}
      alt=""
      width={size}
      height={size}
      className="flex-shrink-0 rounded-sm"
      onError={() => setErrored(true)}
    />
  );
}

type MergedItem = {
  type: "FOLDER" | "LINK";
  title: string;
  url: string | null;
  children: MergedItem[];
};

const STORAGE_KEY = "rcc-quicklinks-expanded";

function getPersistedExpanded(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistExpanded(expanded: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expanded));
  } catch { /* ignore */ }
}

function ItemRow({
  item,
  depth,
  expanded,
  onToggle,
  onClose,
}: {
  item: MergedItem;
  depth: number;
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
  onClose: () => void;
}) {
  const paddingLeft = 12 + depth * 20;

  if (item.type === "LINK" && item.url) {
    return (
      <button
        onClick={() => {
          window.open(item.url!, "_blank", "noopener,noreferrer");
          onClose();
        }}
        className="flex w-full items-center gap-2.5 py-1.5 pr-3 text-sm text-foreground/90 hover:bg-accent hover:text-foreground transition-colors"
        style={{ paddingLeft }}
      >
        <Favicon url={item.url} />
        <span className="truncate">{item.title}</span>
      </button>
    );
  }

  // Folder
  const folderKey = `${depth}:${item.title.toLowerCase()}`;
  const isExpanded = expanded[folderKey] ?? false;

  return (
    <div>
      <button
        onClick={() => onToggle(folderKey)}
        className="flex w-full items-center gap-2 py-1.5 pr-3 text-sm hover:bg-accent text-foreground/80 hover:text-foreground transition-colors"
        style={{ paddingLeft }}
      >
        <ChevronRight
          className={
            "h-3 w-3 text-muted-foreground transition-transform flex-shrink-0 " +
            (isExpanded ? "rotate-90" : "")
          }
        />
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 text-amber-500/80 flex-shrink-0" />
        ) : (
          <FolderClosed className="h-4 w-4 text-amber-500/60 flex-shrink-0" />
        )}
        <span className="truncate font-medium text-[13px]">{item.title}</span>
        <span className="ml-auto text-[10px] text-muted-foreground/50 flex-shrink-0">
          {item.children.length}
        </span>
      </button>
      {isExpanded && item.children.length > 0 && (
        <div>
          {item.children.map((child, i) => (
            <ItemRow
              key={`${child.type}-${child.title}-${i}`}
              item={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onClose={onClose}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function countLinks(items: MergedItem[]): number {
  let count = 0;
  for (const item of items) {
    if (item.type === "LINK") count++;
    count += countLinks(item.children);
  }
  return count;
}

export function QuickLinksDropdown() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const ref = useRef<HTMLDivElement>(null);

  const { data, isLoading } = trpc.quicklinks.getMyLinks.useQuery(undefined, {
    staleTime: 60_000,
  });

  const { data: canManage } = trpc.quicklinks.canManage.useQuery(undefined, {
    staleTime: 300_000,
  });

  useEffect(() => {
    setExpanded(getPersistedExpanded());
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const toggleFolder = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      persistExpanded(next);
      return next;
    });
  }, []);

  const items: MergedItem[] = (data as { items?: MergedItem[] })?.items ?? [];
  const totalLinks = countLinks(items);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        title="Quick Links"
        className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Bookmark className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 rounded-lg border border-border bg-card shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Quick Links
            </span>
            {canManage && (
              <button
                onClick={() => {
                  setOpen(false);
                  router.push("/settings/quick-links");
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Manage Quick Links"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : totalLinks === 0 && items.length === 0 ? (
              <div className="p-6 text-center">
                <Bookmark className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No quick links</p>
                {canManage && (
                  <button
                    onClick={() => { setOpen(false); router.push("/settings/quick-links"); }}
                    className="text-xs text-primary hover:underline mt-1"
                  >
                    Configure Links
                  </button>
                )}
              </div>
            ) : (
              <div className="py-1">
                {items.map((item, i) => (
                  <ItemRow
                    key={`${item.type}-${item.title}-${i}`}
                    item={item}
                    depth={0}
                    expanded={expanded}
                    onToggle={toggleFolder}
                    onClose={() => setOpen(false)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
