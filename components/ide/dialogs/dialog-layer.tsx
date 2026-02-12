import { lazy, Suspense } from "react";
import { useDialogContext } from "@/lib/contexts/dialog-context";

// Lazy load dialogs - not needed on initial render
const AddWorkspaceDialog = lazy(() =>
	import("./add-workspace-dialog").then((m) => ({
		default: m.AddWorkspaceDialog,
	})),
);

const AddAgentDialog = lazy(() =>
	import("./add-agent-dialog").then((m) => ({ default: m.AddAgentDialog })),
);

const DeleteWorkspaceDialog = lazy(() =>
	import("./delete-workspace-dialog").then((m) => ({
		default: m.DeleteWorkspaceDialog,
	})),
);

const CredentialsDialog = lazy(() =>
	import("./credentials-dialog").then((m) => ({
		default: m.CredentialsDialog,
	})),
);

const SystemRequirementsDialog = lazy(() =>
	import("./system-requirements-dialog").then((m) => ({
		default: m.SystemRequirementsDialog,
	})),
);

const SupportInfoDialog = lazy(() =>
	import("./support-info-dialog").then((m) => ({
		default: m.SupportInfoDialog,
	})),
);

export function DialogLayer() {
	const dialogs = useDialogContext();

	return (
		<>
			<Suspense fallback={null}>
				<AddWorkspaceDialog
					open={dialogs.workspaceDialog.isOpen}
					onOpenChange={dialogs.workspaceDialog.onOpenChange}
					onAdd={dialogs.handleAddWorkspace}
					mode={dialogs.workspaceDialog.data?.mode}
				/>
			</Suspense>

			<Suspense fallback={null}>
				<AddAgentDialog
					open={dialogs.agentDialog.isOpen}
					onOpenChange={dialogs.agentDialog.onOpenChange}
					onAdd={dialogs.handleAddOrEditAgent}
					editingAgent={dialogs.agentDialog.data?.agent}
					onOpenCredentials={(providerId) =>
						dialogs.credentialsDialog.open({ providerId })
					}
					preselectedAgentTypeId={dialogs.agentDialog.data?.agentTypeId}
				/>
			</Suspense>

			<Suspense fallback={null}>
				<DeleteWorkspaceDialog
					open={dialogs.deleteWorkspaceDialog.isOpen}
					onOpenChange={dialogs.deleteWorkspaceDialog.onOpenChange}
					workspace={dialogs.deleteWorkspaceDialog.data}
					onConfirm={dialogs.handleConfirmDeleteWorkspace}
				/>
			</Suspense>

			<Suspense fallback={null}>
				<CredentialsDialog
					open={dialogs.credentialsDialog.isOpen}
					onOpenChange={dialogs.credentialsDialog.onOpenChange}
					initialProviderId={dialogs.credentialsDialog.data?.providerId}
				/>
			</Suspense>

			<Suspense fallback={null}>
				<SystemRequirementsDialog
					open={dialogs.systemRequirements.isOpen}
					messages={dialogs.systemRequirements.messages}
					onClose={dialogs.systemRequirements.close}
				/>
			</Suspense>

			<Suspense fallback={null}>
				<SupportInfoDialog
					open={dialogs.supportInfoDialog.isOpen}
					onClose={dialogs.supportInfoDialog.close}
				/>
			</Suspense>
		</>
	);
}
