import type * as React from "react";
import { MainContentProvider } from "./main-content-context";
import { PageLayoutProvider } from "./page-layout-context";
import { ProjectEventsProvider } from "./project-events-context";

interface AppProviderProps {
	children: React.ReactNode;
}

/**
 * Combined provider that wraps all domain contexts.
 * - ProjectEventsProvider: SSE connection for real-time updates
 * - PageLayoutProvider: Page layout state (sidebars)
 * - MainContentProvider: Main content view state and session data
 */
export function AppProvider({ children }: AppProviderProps) {
	return (
		<ProjectEventsProvider>
			<PageLayoutProvider>
				<MainContentProvider>{children}</MainContentProvider>
			</PageLayoutProvider>
		</ProjectEventsProvider>
	);
}
