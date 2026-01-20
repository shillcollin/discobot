"use client";

import * as React from "react";
import { DialogLayer } from "@/components/ide/dialog-layer";
import { Header, LeftSidebar, MainContent } from "@/components/ide/layout";
import {
	DialogProvider,
	SessionProvider,
	useSessionContext,
} from "@/lib/contexts";
import {
	STORAGE_KEYS,
	usePersistedState,
} from "@/lib/hooks/use-persisted-state";

function LoadingScreen() {
	return (
		<div className="h-screen flex items-center justify-center bg-background">
			<div className="text-muted-foreground">Loading...</div>
		</div>
	);
}

function IDEContent() {
	const [leftSidebarOpen, setLeftSidebarOpen] = usePersistedState(
		STORAGE_KEYS.LEFT_SIDEBAR_OPEN,
		true,
	);
	const [rightSidebarOpen, setRightSidebarOpen] = usePersistedState(
		STORAGE_KEYS.RIGHT_SIDEBAR_OPEN,
		true,
	);

	// Track sidebar states before maximize to restore them
	const sidebarStatesBeforeMaximize = React.useRef<{
		left: boolean;
		right: boolean;
	} | null>(null);

	const handleDiffMaximizeChange = React.useCallback(
		(isMaximized: boolean) => {
			if (isMaximized) {
				// Save current states and close sidebars
				sidebarStatesBeforeMaximize.current = {
					left: leftSidebarOpen,
					right: rightSidebarOpen,
				};
				setLeftSidebarOpen(false);
				setRightSidebarOpen(false);
			} else {
				// Restore previous states
				if (sidebarStatesBeforeMaximize.current) {
					setLeftSidebarOpen(sidebarStatesBeforeMaximize.current.left);
					setRightSidebarOpen(sidebarStatesBeforeMaximize.current.right);
					sidebarStatesBeforeMaximize.current = null;
				}
			}
		},
		[
			leftSidebarOpen,
			rightSidebarOpen,
			setLeftSidebarOpen,
			setRightSidebarOpen,
		],
	);

	const session = useSessionContext();

	// Loading state
	if (session.workspacesLoading || session.agentsLoading) {
		return <LoadingScreen />;
	}

	return (
		<div className="h-screen flex flex-col bg-background">
			<Header
				leftSidebarOpen={leftSidebarOpen}
				onToggleSidebar={() => setLeftSidebarOpen(!leftSidebarOpen)}
				onNewSession={session.handleNewSession}
			/>

			<div className="flex-1 flex overflow-hidden">
				<LeftSidebar isOpen={leftSidebarOpen} />
				<MainContent
					rightSidebarOpen={rightSidebarOpen}
					onToggleRightSidebar={() => setRightSidebarOpen(!rightSidebarOpen)}
					onDiffMaximizeChange={handleDiffMaximizeChange}
				/>
			</div>

			<DialogLayer />
		</div>
	);
}

export default function IDEChatPage() {
	return (
		<SessionProvider>
			<DialogProvider>
				<IDEContent />
			</DialogProvider>
		</SessionProvider>
	);
}
