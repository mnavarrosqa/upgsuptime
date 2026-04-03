"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  startTransition,
} from "react";

const STORAGE_KEY = "upgs_unread_incidents";

interface ActivityContextValue {
  unreadCount: number;
  addUnread: (id: string) => void;
  removeUnread: (id: string) => void;
  markAllRead: () => void;
}

const ActivityContext = createContext<ActivityContextValue>({
  unreadCount: 0,
  addUnread: () => {},
  removeUnread: () => {},
  markAllRead: () => {},
});

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());

  // Load from localStorage on mount
  useEffect(() => {
    startTransition(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setUnreadIds(new Set(JSON.parse(stored) as string[]));
        }
      } catch {}
    });
  }, []);

  // Persist to localStorage whenever unreadIds changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...unreadIds]));
    } catch {}
  }, [unreadIds]);

  const addUnread = useCallback((id: string) => {
    setUnreadIds((prev) => {
      if (prev.has(id)) return prev;
      return new Set([...prev, id]);
    });
  }, []);

  const removeUnread = useCallback((id: string) => {
    setUnreadIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setUnreadIds(new Set());
  }, []);

  return (
    <ActivityContext.Provider
      value={{ unreadCount: unreadIds.size, addUnread, removeUnread, markAllRead }}
    >
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  return useContext(ActivityContext);
}
