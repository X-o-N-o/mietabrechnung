import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Category, Item, Person, Rent, Report } from "@shared/types.ts";

// Relative URLs, damit die App hinter dem Home-Assistant-Ingress-Präfix funktioniert
export async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`api/${url}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || `Fehler ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: ({ queryKey }) => api("GET", queryKey.join("/")),
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export const usePersons = () => useQuery<Person[]>({ queryKey: ["persons"] });
export const useCategories = () => useQuery<Category[]>({ queryKey: ["categories"] });
export const useRents = () => useQuery<Rent[]>({ queryKey: ["rents"] });
export const useYears = () => useQuery<number[]>({ queryKey: ["years"] });
export const useItems = () => useQuery<Item[]>({ queryKey: ["items"] });
export const useReport = (from: string, to: string) =>
  useQuery<Report>({ queryKey: [`report?from=${from}&to=${to}`], placeholderData: (prev) => prev });

/** Mutation, die danach alle Daten neu lädt und Erfolg/Fehler als Toast meldet. */
export function useApiMutation<V, R = unknown>(fn: (v: V) => Promise<R>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries();
      if (success) toast.success(success);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
