"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  DEFAULT_TIMEZONE,
  formatDateTime,
  formatDate,
  formatTime,
  formatTimeShort,
  formatDateShort,
  formatRelative,
} from "@/lib/datetime";

type DateInput = Date | string | number | null | undefined;

export function useTimezone() {
  const { data: profile } = trpc.user.getProfile.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const timezone = (profile?.timezone as string) || DEFAULT_TIMEZONE;

  const fmt = useMemo(
    () => ({
      dateTime: (input: DateInput) => formatDateTime(input, timezone),
      date: (input: DateInput) => formatDate(input, timezone),
      time: (input: DateInput) => formatTime(input, timezone),
      timeShort: (input: DateInput) => formatTimeShort(input, timezone),
      dateShort: (input: DateInput) => formatDateShort(input, timezone),
      relative: (input: DateInput) => formatRelative(input, timezone),
    }),
    [timezone],
  );

  return { timezone, ...fmt };
}
