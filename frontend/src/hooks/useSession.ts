import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/client";
import type { Scene, SessionWithScenes } from "../types";

export function useSession(id: number) {
  return useQuery<SessionWithScenes>({
    queryKey: ["session", id],
    queryFn: async () => {
      const { data } = await apiClient.get<SessionWithScenes>(`/sessions/${id}`);
      return data;
    },
  });
}

export function useCreateScene(sessionId: number) {
  const queryClient = useQueryClient();
  return useMutation<Scene, Error, { title: string; body?: string }>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<Scene>(
        `/sessions/${sessionId}/scenes`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
  });
}

export function useUpdateScene(sessionId: number) {
  const queryClient = useQueryClient();
  return useMutation<Scene, Error, { id: number; title?: string; body?: string }>({
    mutationFn: async ({ id, ...body }) => {
      const { data } = await apiClient.put<Scene>(`/scenes/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
  });
}

export function useDeleteScene(sessionId: number) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await apiClient.delete(`/scenes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
  });
}

export function useReorderScenes(sessionId: number) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, number[]>({
    mutationFn: async (sceneIds) => {
      await apiClient.put(`/sessions/${sessionId}/scenes/reorder`, {
        scene_ids: sceneIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
  });
}
