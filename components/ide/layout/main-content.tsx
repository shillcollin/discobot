import * as React from "react";
import { SessionListTable } from "@/components/ide/session-list-table";
import { SessionView } from "@/components/ide/session-view";
import { useMainContentContext } from "@/lib/contexts/main-content-context";
import { SessionViewProvider } from "@/lib/contexts/session-view-context";

export function MainContent() {
	const { view, getSessionIdForView, isNewSession, sessionCreated } =
		useMainContentContext();

	// Get session ID for rendering SessionView (includes temp ID for new sessions)
	const sessionIdForView = getSessionIdForView();
	const isNew = isNewSession();

	// Handle session creation - updates view with workspace/agent IDs
	const handleSessionCreated = React.useCallback(
		(sessionId: string, workspaceId: string, agentId: string) => {
			sessionCreated(sessionId, workspaceId, agentId);
		},
		[sessionCreated],
	);

	return (
		<main className="flex-1 flex overflow-hidden">
			{view.type === "workspace-sessions" ? (
				<SessionListTable />
			) : (
				<SessionViewProvider
					key={`${sessionIdForView}:${isNew}`}
					sessionId={sessionIdForView}
				>
					<SessionView
						sessionId={sessionIdForView}
						isNew={isNew}
						onSessionCreated={handleSessionCreated}
					/>
				</SessionViewProvider>
			)}
		</main>
	);
}
