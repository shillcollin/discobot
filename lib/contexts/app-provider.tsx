"use client";

import type * as React from "react";
import { AgentProvider } from "./agent-context";
import { MainPanelProvider } from "./main-panel-context";
import { ProjectEventsProvider } from "./project-events-context";

interface AppProviderProps {
	children: React.ReactNode;
}

/**
 * Combined provider that wraps all domain contexts.
 * - ProjectEventsProvider: SSE connection for real-time updates
 * - AgentProvider: Agent and SupportedAgentType objects
 * - MainPanelProvider: Main panel view state and session data
 */
export function AppProvider({ children }: AppProviderProps) {
	return (
		<ProjectEventsProvider>
			<AgentProvider>
				<MainPanelProvider>{children}</MainPanelProvider>
			</AgentProvider>
		</ProjectEventsProvider>
	);
}
