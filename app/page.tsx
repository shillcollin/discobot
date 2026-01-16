"use client";

import * as React from "react";
import { AddAgentDialog } from "@/components/ide/add-agent-dialog";
import { AddWorkspaceDialog } from "@/components/ide/add-workspace-dialog";
import { CredentialsDialog } from "@/components/ide/credentials-dialog";
import { DeleteWorkspaceDialog } from "@/components/ide/delete-workspace-dialog";
import { Header, LeftSidebar, MainContent } from "@/components/ide/layout";
import { SystemRequirementsDialog } from "@/components/ide/system-requirements-dialog";
import { WelcomeModal } from "@/components/ide/welcome-modal";
import { api } from "@/lib/api-client";
import type {
	CreateAgentRequest,
	CreateWorkspaceRequest,
	StatusMessage,
	SupportedAgentType,
	Workspace,
} from "@/lib/api-types";
import { useAgentTypes } from "@/lib/hooks/use-agent-types";
import { useAgents } from "@/lib/hooks/use-agents";
import { useAuthProviders } from "@/lib/hooks/use-auth-providers";
import { useCredentials } from "@/lib/hooks/use-credentials";
import { useDialogState } from "@/lib/hooks/use-dialog-state";
import {
	STORAGE_KEYS,
	usePersistedState,
} from "@/lib/hooks/use-persisted-state";
import { useProjectEvents } from "@/lib/hooks/use-project-events";
import { useWorkspaces } from "@/lib/hooks/use-workspaces";

export default function IDEChatPage() {
	const [leftSidebarOpen, setLeftSidebarOpen] = usePersistedState(
		STORAGE_KEYS.LEFT_SIDEBAR_OPEN,
		true,
	);
	// Store only IDs - derive full objects from SWR data to stay in sync
	const [selectedSessionId, setSelectedSessionId] = React.useState<
		string | null
	>(null);
	const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(
		null,
	);
	const [preselectedWorkspaceId, setPreselectedWorkspaceId] = React.useState<
		string | null
	>(null);
	const [workspaceSelectTrigger, setWorkspaceSelectTrigger] = React.useState(0);
	// Trigger to reset ChatPanel state (forces remount)
	const [chatResetTrigger, setChatResetTrigger] = React.useState(0);

	// System status check
	const [systemStatusChecked, setSystemStatusChecked] = React.useState(false);
	const [systemStatusMessages, setSystemStatusMessages] = React.useState<
		StatusMessage[]
	>([]);
	const [showSystemRequirements, setShowSystemRequirements] =
		React.useState(false);
	// Track if welcome modal was skipped for this session (resets on refresh)
	const [welcomeSkipped, setWelcomeSkipped] = React.useState(false);

	// Check system status on mount
	React.useEffect(() => {
		async function checkSystemStatus() {
			try {
				const status = await api.getSystemStatus();
				if (status.messages && status.messages.length > 0) {
					setSystemStatusMessages(status.messages);
					setShowSystemRequirements(true);
				}
			} catch (error) {
				console.error("Failed to check system status:", error);
			} finally {
				setSystemStatusChecked(true);
			}
		}
		checkSystemStatus();
	}, []);

	// Data fetching
	const {
		workspaces,
		createWorkspace,
		deleteWorkspace,
		isLoading: workspacesLoading,
		mutate: mutateWorkspaces,
	} = useWorkspaces();
	const {
		agents,
		createAgent,
		updateAgent,
		isLoading: agentsLoading,
		mutate: mutateAgents,
	} = useAgents();
	const { agentTypes } = useAgentTypes();
	const { authProviders } = useAuthProviders();
	const { credentials } = useCredentials();

	// Subscribe to SSE events for real-time session status updates
	useProjectEvents({
		onSessionUpdated: (data) => {
			// If the updated session is the currently selected one, the SWR mutation
			// will refresh it automatically. Just log for debugging.
			console.log("Session updated:", data.sessionId, "->", data.status);
		},
	});

	// Dialog state
	const dialogs = useDialogState();
	// Track pending agent type when user needs to configure credentials first
	// Value will be read when credentials dialog handler is implemented
	const [_pendingAgentType, setPendingAgentType] =
		React.useState<SupportedAgentType | null>(null);
	// Delete workspace dialog state
	const [deleteWorkspaceDialogOpen, setDeleteWorkspaceDialogOpen] =
		React.useState(false);
	const [workspaceToDelete, setWorkspaceToDelete] =
		React.useState<Workspace | null>(null);

	// Credentials dialog state
	const [credentialsDialogOpen, setCredentialsDialogOpen] =
		React.useState(false);
	const [credentialsInitialProviderId, setCredentialsInitialProviderId] =
		React.useState<string | null>(null);

	const openCredentialsForProvider = React.useCallback(
		(providerId?: string) => {
			setCredentialsInitialProviderId(providerId ?? null);
			setCredentialsDialogOpen(true);
		},
		[],
	);

	// Derive full objects from SWR data - automatically updates when data changes
	// This ensures UI always reflects current state (no stale references after deletions)
	const selectedSession = React.useMemo(() => {
		if (!selectedSessionId) return null;
		for (const workspace of workspaces) {
			const session = workspace.sessions.find(
				(s) => s.id === selectedSessionId,
			);
			if (session) return session;
		}
		return null;
	}, [selectedSessionId, workspaces]);

	// Computed values derived from selected session
	const sessionAgent = React.useMemo(() => {
		if (!selectedSession?.agentId) return null;
		return agents.find((a) => a.id === selectedSession.agentId) || null;
	}, [selectedSession, agents]);

	const sessionWorkspace = React.useMemo(() => {
		if (!selectedSession?.workspaceId) return null;
		return (
			workspaces.find((ws) => ws.id === selectedSession.workspaceId) || null
		);
	}, [selectedSession, workspaces]);

	// Handlers
	const handleSessionSelect = React.useCallback((session: { id: string }) => {
		setSelectedSessionId(session.id);
		setPreselectedWorkspaceId(null);
	}, []);

	const handleNewSession = React.useCallback(() => {
		setSelectedSessionId(null);
		setPreselectedWorkspaceId(null);
		setChatResetTrigger((prev) => prev + 1);
	}, []);

	const handleAddSession = React.useCallback((workspaceId: string) => {
		setSelectedSessionId(null);
		setPreselectedWorkspaceId(workspaceId);
		setWorkspaceSelectTrigger((prev) => prev + 1);
	}, []);

	// Handle workspace selection from breadcrumb dropdown
	// TODO: Wire this up to workspace dropdown when implemented
	const _handleWorkspaceSelect = React.useCallback((workspace: Workspace) => {
		// Find first non-closed session in this workspace
		const firstSession = workspace.sessions.find((s) => s.status !== "closed");
		if (firstSession) {
			setSelectedSessionId(firstSession.id);
		} else {
			// No open sessions - clear selection and preselect this workspace for new session
			setSelectedSessionId(null);
			setPreselectedWorkspaceId(workspace.id);
		}
	}, []);
	void _handleWorkspaceSelect;

	const handleAddWorkspace = async (newWorkspace: CreateWorkspaceRequest) => {
		const workspace = await createWorkspace(newWorkspace);
		dialogs.closeWorkspaceDialog();
		// Auto-select the newly created workspace
		if (workspace) {
			setPreselectedWorkspaceId(workspace.id);
			setWorkspaceSelectTrigger((prev) => prev + 1);
		}
	};

	const handleDeleteWorkspace = (workspace: Workspace) => {
		setWorkspaceToDelete(workspace);
		setDeleteWorkspaceDialogOpen(true);
	};

	const handleConfirmDeleteWorkspace = async (deleteFiles: boolean) => {
		if (!workspaceToDelete) return;

		const workspaceId = workspaceToDelete.id;
		await deleteWorkspace(workspaceId, deleteFiles);

		// Clear selection if the deleted workspace was preselected
		if (preselectedWorkspaceId === workspaceId) {
			setPreselectedWorkspaceId(null);
		}
		// Clear session if it belonged to the deleted workspace
		// Note: With derived state, selectedSession will auto-clear when workspace is removed
		// from SWR data, but we clear the ID explicitly for immediate feedback
		if (selectedSession?.workspaceId === workspaceId) {
			setSelectedSessionId(null);
		}

		setDeleteWorkspaceDialogOpen(false);
		setWorkspaceToDelete(null);
	};

	const handleAddOrEditAgent = async (agentData: CreateAgentRequest) => {
		if (dialogs.editingAgent) {
			await updateAgent(dialogs.editingAgent.id, agentData);
			mutateAgents();
		} else {
			const agent = await createAgent(agentData);
			if (agent) {
				setSelectedAgentId(agent.id);
			}
		}
		dialogs.closeAgentDialog();
	};

	// Called when chat endpoint creates a new session
	const handleSessionCreated = async (sessionId: string) => {
		try {
			// Refresh the workspaces list first (sessions are nested within workspaces)
			await mutateWorkspaces();

			// Set the session ID - the full session object will be derived from workspaces
			setSelectedSessionId(sessionId);
			setPreselectedWorkspaceId(null);

			// Fetch the session to get agentId for agent selection
			const session = await api.getSession(sessionId);
			if (session.agentId) {
				setSelectedAgentId(session.agentId);
			}
		} catch (error) {
			console.error("Failed to fetch created session:", error);
		}
	};

	// Loading state
	if (workspacesLoading || agentsLoading) {
		return (
			<div className="h-screen flex items-center justify-center bg-background">
				<div className="text-muted-foreground">Loading...</div>
			</div>
		);
	}

	return (
		<div className="h-screen flex flex-col bg-background">
			<Header
				leftSidebarOpen={leftSidebarOpen}
				onToggleSidebar={() => setLeftSidebarOpen(!leftSidebarOpen)}
				onNewSession={handleNewSession}
			/>

			<div className="flex-1 flex overflow-hidden">
				<LeftSidebar
					isOpen={leftSidebarOpen}
					workspaces={workspaces}
					agents={agents}
					agentTypes={agentTypes}
					selectedSessionId={selectedSessionId}
					selectedAgentId={selectedAgentId}
					onSessionSelect={handleSessionSelect}
					onAgentSelect={(agent) => setSelectedAgentId(agent?.id ?? null)}
					onAddWorkspace={dialogs.openWorkspaceDialog}
					onAddSession={handleAddSession}
					onDeleteWorkspace={handleDeleteWorkspace}
					onAddAgent={() => dialogs.openAgentDialog()}
					onConfigureAgent={(agent) => dialogs.openAgentDialog(agent)}
				/>

				<MainContent
					selectedSession={selectedSession}
					workspaces={workspaces}
					agents={agents}
					agentTypes={agentTypes}
					preselectedWorkspaceId={preselectedWorkspaceId}
					workspaceSelectTrigger={workspaceSelectTrigger}
					chatResetTrigger={chatResetTrigger}
					selectedAgentId={selectedAgentId}
					onAddWorkspace={dialogs.openWorkspaceDialog}
					onAddAgent={() => dialogs.openAgentDialog()}
					onSessionCreated={handleSessionCreated}
					sessionAgent={sessionAgent}
					sessionWorkspace={sessionWorkspace}
				/>
			</div>

			<AddWorkspaceDialog
				open={dialogs.showAddWorkspaceDialog}
				onOpenChange={dialogs.setShowAddWorkspaceDialog}
				onAdd={handleAddWorkspace}
			/>

			<AddAgentDialog
				open={dialogs.showAddAgentDialog}
				onOpenChange={dialogs.handleAgentDialogOpenChange}
				onAdd={handleAddOrEditAgent}
				editingAgent={dialogs.editingAgent}
				onOpenCredentials={openCredentialsForProvider}
				preselectedAgentTypeId={dialogs.preselectedAgentTypeId}
			/>

			<DeleteWorkspaceDialog
				open={deleteWorkspaceDialogOpen}
				onOpenChange={setDeleteWorkspaceDialogOpen}
				workspace={workspaceToDelete}
				onConfirm={handleConfirmDeleteWorkspace}
			/>

			<CredentialsDialog
				open={credentialsDialogOpen}
				onOpenChange={(open) => {
					setCredentialsDialogOpen(open);
					if (!open) {
						setCredentialsInitialProviderId(null);
					}
				}}
				initialProviderId={credentialsInitialProviderId}
			/>

			<SystemRequirementsDialog
				open={showSystemRequirements}
				messages={systemStatusMessages}
				onClose={() => setShowSystemRequirements(false)}
			/>

			<WelcomeModal
				open={
					systemStatusChecked &&
					!showSystemRequirements &&
					!agentsLoading &&
					agents.length === 0 &&
					!welcomeSkipped
				}
				agentTypes={agentTypes}
				authProviders={authProviders}
				configuredCredentials={credentials}
				hasExistingWorkspaces={workspaces.length > 0}
				onSkip={() => setWelcomeSkipped(true)}
				onComplete={async (agentType, authProviderId, workspace) => {
					if (authProviderId) {
						// Auth provider selected - store pending agent and open credentials dialog
						// Agent will be created automatically when credentials are configured
						setPendingAgentType(agentType);
						openCredentialsForProvider(authProviderId);
						// If workspace was provided, create it after agent setup
						if (workspace) {
							await createWorkspace(workspace);
						}
					} else {
						// "Free" selected or already has credentials - create agent directly and make it default
						const agent = await createAgent({
							name: agentType.name,
							description: agentType.description,
							agentType: agentType.id,
						});
						// Make it the default agent
						await api.setDefaultAgent(agent.id);
						mutateAgents();
						// Create workspace if provided
						if (workspace) {
							const ws = await createWorkspace(workspace);
							if (ws) {
								setPreselectedWorkspaceId(ws.id);
							}
						}
					}
				}}
			/>
		</div>
	);
}
