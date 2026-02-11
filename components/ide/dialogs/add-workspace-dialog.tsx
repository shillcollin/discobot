import { AlertCircle } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { CreateWorkspaceRequest } from "@/lib/api-types";
import { WorkspaceForm, type WorkspaceFormRef } from "../workspace-form";

interface AddWorkspaceDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onAdd: (workspace: CreateWorkspaceRequest) => Promise<void>;
	mode?: "git" | "local" | "generic";
}

export function AddWorkspaceDialog({
	open,
	onOpenChange,
	onAdd,
	mode = "generic",
}: AddWorkspaceDialogProps) {
	const formRef = React.useRef<WorkspaceFormRef>(null);
	const [isValid, setIsValid] = React.useState(false);
	const [isSubmitting, setIsSubmitting] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	// Reset error when dialog opens/closes
	React.useEffect(() => {
		if (!open) {
			setError(null);
			setIsSubmitting(false);
		}
	}, [open]);

	const handleSubmit = () => {
		formRef.current?.submit();
	};

	const handleFormSubmit = async (workspace: CreateWorkspaceRequest) => {
		setIsSubmitting(true);
		setError(null);
		try {
			await onAdd(workspace);
			onOpenChange(false);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to create workspace",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	// Customize dialog content based on mode
	const dialogContent = {
		git: {
			title: "Clone Git Repository",
			description:
				"Clone an existing repository from GitHub, GitLab, or any Git URL.",
		},
		local: {
			title: "Open Directory",
			description: "Point to a local folder that contains your project.",
		},
		generic: {
			title: "Add Workspace",
			description:
				"Create a new workspace from a local folder or git repository.",
		},
	};

	const { title, description } = dialogContent[mode];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="py-4">
					<WorkspaceForm
						ref={formRef}
						onSubmit={handleFormSubmit}
						onValidationChange={setIsValid}
						mode={mode}
					/>
					{error && (
						<div className="mt-4 flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
							<AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
							<span>{error}</span>
						</div>
					)}
					<div className="mt-4 text-xs text-muted-foreground space-y-1">
						<p className="font-medium">Supported formats:</p>
						<ul className="list-disc list-inside space-y-0.5 pl-1">
							{(mode === "local" || mode === "generic") && (
								<li>Local paths: ~/projects/app, /var/www/site</li>
							)}
							{(mode === "git" || mode === "generic") && (
								<>
									<li>
										GitHub: org/repo, github.com/org/repo,
										git@github.com:org/repo
									</li>
									<li>
										Git: https://gitlab.com/org/repo, git@bitbucket.org:org/repo
									</li>
								</>
							)}
						</ul>
					</div>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
						{isSubmitting ? "Creating..." : "Add Workspace"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
