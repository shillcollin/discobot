"use client";

import useSWR, { useSWRConfig } from "swr";
import { api } from "../api-client";
import type { UpdateSessionRequest } from "../api-types";
import { useWorkspaces } from "./use-workspaces";

export function useSessions(workspaceId: string | null) {
	const { data, error, isLoading, mutate } = useSWR(
		workspaceId ? `sessions-${workspaceId}` : null,
		() => (workspaceId ? api.getSessions(workspaceId) : null),
	);

	return {
		sessions: data?.sessions || [],
		isLoading,
		error,
		mutate,
	};
}

export function useSession(sessionId: string | null) {
	const { data, error, isLoading, mutate } = useSWR(
		sessionId ? `session-${sessionId}` : null,
		() => (sessionId ? api.getSession(sessionId) : null),
	);

	const updateSession = async (data: UpdateSessionRequest) => {
		if (!sessionId) return;
		const session = await api.updateSession(sessionId, data);
		mutate();
		return session;
	};

	return {
		session: data,
		isLoading,
		error,
		updateSession,
		mutate,
	};
}

// NOTE: useCreateSession removed - sessions are created implicitly via /chat endpoint

export function useDeleteSession() {
	const { mutate: mutateWorkspaces } = useWorkspaces();
	const { mutate: globalMutate } = useSWRConfig();

	/**
	 * Delete a session and invalidate all related caches.
	 * @param sessionId - The session ID to delete
	 * @param workspaceId - Optional workspace ID to invalidate the sessions-{workspaceId} cache
	 */
	const deleteSession = async (sessionId: string, workspaceId?: string) => {
		await api.deleteSession(sessionId);

		// Invalidate the specific session cache
		globalMutate(`session-${sessionId}`);

		// Invalidate the workspace's sessions list if workspaceId provided
		if (workspaceId) {
			globalMutate(`sessions-${workspaceId}`);
		}

		// Invalidate workspaces (which contain nested sessions)
		mutateWorkspaces();
	};

	return { deleteSession };
}
