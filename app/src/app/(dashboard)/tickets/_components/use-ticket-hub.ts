"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useTimezone } from "@/hooks/use-timezone";

export function useTicketHub() {
  const utils = trpc.useUtils();
  const tz = useTimezone();

  // Shared identity + metadata queries
  const myMember = trpc.psa.getMyMemberId.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const members = trpc.psa.getMembers.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const boards = trpc.psa.getBoards.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: 1,
  });

  // Cross-reference numeric member ID → CW identifier (e.g. "Andrew")
  const myIdentifier = useMemo(() => {
    if (!myMember.data || !members.data) return null;
    const match = members.data.find((m) => m.id === myMember.data);
    return match?.identifier ?? null;
  }, [myMember.data, members.data]);

  // Shared mutations
  const updateTicket = trpc.psa.updateTicket.useMutation({
    onSuccess: () => {
      utils.psa.getTickets.invalidate();
      utils.psa.getTicketNotes.invalidate();
    },
  });

  const addNote = trpc.psa.addTicketNote.useMutation({
    onSuccess: () => {
      utils.psa.getTicketNotes.invalidate();
    },
  });

  const addTime = trpc.psa.addTimeEntry.useMutation({
    onSuccess: () => {
      utils.psa.getTickets.invalidate();
    },
  });

  const createTicketMutation = trpc.psa.createTicket.useMutation({
    onSuccess: () => {
      utils.psa.getTickets.invalidate();
    },
  });

  return {
    myMember,
    members,
    boards,
    myIdentifier,
    updateTicket,
    addNote,
    addTime,
    createTicketMutation,
    utils,
    ...tz,
  };
}

export type TicketHub = ReturnType<typeof useTicketHub>;
