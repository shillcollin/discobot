import * as React from "react";
import { lazy, Suspense } from "react";
import type { Agent, Icon } from "@/lib/api-types";
import { useDialogContext } from "@/lib/contexts/dialog-context";
import { useAgentTypes } from "@/lib/hooks/use-agent-types";
import { useAgents } from "@/lib/hooks/use-agents";
import { useWorkspaces } from "@/lib/hooks/use-workspaces";

// Lazy-load Framer Motion components to reduce initial bundle size (~35KB)
const WelcomeHeader = lazy(() =>
	import("@/components/ide/welcome-animation").then((mod) => ({
		default: mod.WelcomeHeader,
	})),
);

const WelcomeSelectors = lazy(() =>
	import("@/components/ide/welcome-animation").then((mod) => ({
		default: mod.WelcomeSelectors,
	})),
);

interface ChatNewContentProps {
	/** Whether to show the welcome UI */
	show: boolean;
	/** Currently selected workspace ID (for form submission) */
	selectedWorkspaceId: string | null;
	/** Currently selected agent ID (for form submission) */
	selectedAgentId: string | null;
	/** Callback when workspace selection changes */
	onWorkspaceChange: (workspaceId: string | null) => void;
	/** Callback when agent selection changes */
	onAgentChange: (agentId: string | null) => void;
}

/**
 * ChatNewContent - Welcome UI for new chat sessions
 * Shows animated header and workspace/agent selectors
 * Only rendered when starting a new session (isNew prop)
 */
export function ChatNewContent({
	show,
	selectedWorkspaceId,
	selectedAgentId,
	onWorkspaceChange,
	onAgentChange,
}: ChatNewContentProps) {
	const { agentDialog, workspaceDialog } = useDialogContext();
	const { workspaces } = useWorkspaces();
	const { agents } = useAgents();
	const { agentTypes } = useAgentTypes();

	const [localSelectedWorkspaceId, setLocalSelectedWorkspaceId] =
		React.useState<string | null>(selectedWorkspaceId);
	const [localSelectedAgentId, setLocalSelectedAgentId] = React.useState<
		string | null
	>(selectedAgentId);
	const [isShimmering, _setIsShimmering] = React.useState(false);

	// Sync local state with props
	React.useEffect(() => {
		setLocalSelectedWorkspaceId(selectedWorkspaceId);
	}, [selectedWorkspaceId]);

	React.useEffect(() => {
		setLocalSelectedAgentId(selectedAgentId);
	}, [selectedAgentId]);

	// Auto-select first workspace when workspaces become available and nothing is selected
	React.useEffect(() => {
		const currentWorkspaceExists = workspaces.some(
			(ws) => ws.id === localSelectedWorkspaceId,
		);
		if (!localSelectedWorkspaceId || !currentWorkspaceExists) {
			const workspaceToSelect = workspaces[0];
			if (workspaceToSelect) {
				setLocalSelectedWorkspaceId(workspaceToSelect.id);
				onWorkspaceChange(workspaceToSelect.id);
			}
		}
	}, [workspaces, localSelectedWorkspaceId, onWorkspaceChange]);

	// Auto-select default agent when agents become available and nothing is selected
	React.useEffect(() => {
		const currentAgentExists = agents.some(
			(a) => a.id === localSelectedAgentId,
		);
		if (!localSelectedAgentId || !currentAgentExists) {
			const defaultAgent = agents.find((a) => a.isDefault);
			const agentToSelect = defaultAgent || agents[0];
			if (agentToSelect) {
				setLocalSelectedAgentId(agentToSelect.id);
				onAgentChange(agentToSelect.id);
			}
		}
	}, [agents, localSelectedAgentId, onAgentChange]);

	const selectedWorkspace = workspaces.find(
		(ws) => ws.id === localSelectedWorkspaceId,
	);
	const selectedAgent = agents.find((a) => a.id === localSelectedAgentId);

	const getAgentIcons = (agent: Agent): Icon[] | undefined => {
		const agentType = agentTypes.find((t) => t.id === agent.agentType);
		return agentType?.icons;
	};

	const handleSelectAgent = (agentId: string) => {
		setLocalSelectedAgentId(agentId);
		onAgentChange(agentId);
	};

	const handleSelectWorkspace = (workspaceId: string) => {
		setLocalSelectedWorkspaceId(workspaceId);
		onWorkspaceChange(workspaceId);
	};

	if (!show) {
		return null;
	}

	return (
		<>
			{/* Welcome header - animated in/out based on show prop */}
			<Suspense fallback={null}>
				<WelcomeHeader show={show} />
			</Suspense>

			{/* Agent/Workspace selectors - animated in/out based on show prop */}
			<Suspense fallback={null}>
				<WelcomeSelectors
					show={show}
					agents={agents}
					workspaces={workspaces}
					selectedAgent={selectedAgent}
					selectedWorkspace={selectedWorkspace}
					isShimmering={isShimmering}
					getAgentIcons={getAgentIcons}
					onSelectAgent={handleSelectAgent}
					onSelectWorkspace={handleSelectWorkspace}
					onAddAgent={() => agentDialog.open()}
					onAddWorkspace={() => workspaceDialog.open()}
				/>
			</Suspense>
		</>
	);
}
