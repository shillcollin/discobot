"use client";

import { PatchDiff } from "@pierre/diffs/react";
import { Columns2, FileCode, Loader2, Rows2, X } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";
import {
	PanelControls,
	type PanelState,
} from "@/components/ide/panel-controls";
import { Button } from "@/components/ui/button";
import type { FileNode } from "@/lib/api-types";
import { useSessionContext } from "@/lib/contexts/session-context";
import { useSessionFileDiff } from "@/lib/hooks/use-session-files";
import { cn } from "@/lib/utils";

type DiffStyle = "unified" | "split";

interface TabbedDiffViewProps {
	openFiles: FileNode[];
	activeFileId: string | null;
	onTabSelect: (file: FileNode) => void;
	onTabClose: (fileId: string) => void;
	panelState: PanelState;
	onMaximize: () => void;
	onClose: () => void;
	className?: string;
	hideEmptyState?: boolean;
}

export function TabbedDiffView({
	openFiles,
	activeFileId,
	onTabSelect,
	onTabClose,
	panelState,
	onMaximize,
	onClose,
	className,
	hideEmptyState,
}: TabbedDiffViewProps) {
	const [diffStyle, setDiffStyle] = React.useState<DiffStyle>("split");
	const activeFile = openFiles.find((f) => f.id === activeFileId);

	if (openFiles.length === 0 && !hideEmptyState) {
		return (
			<div className={cn("flex flex-col h-full bg-background", className)}>
				<div className="flex-1 flex items-center justify-center text-muted-foreground">
					Click a file to view its diff
				</div>
			</div>
		);
	}

	if (openFiles.length === 0) {
		return null;
	}

	return (
		<div className={cn("flex flex-col h-full bg-background", className)}>
			{/* Header: FILES label, tabs, diff toggle, panel controls */}
			<div className="h-10 flex items-center border-b border-border bg-muted/30 shrink-0">
				{/* FILES label */}
				<span className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-3 shrink-0">
					Files
				</span>

				{/* Tabs */}
				<div className="flex items-center overflow-x-auto flex-1 h-full">
					{openFiles.map((file) => (
						<div
							key={file.id}
							role="tab"
							tabIndex={0}
							aria-selected={activeFileId === file.id}
							className={cn(
								"flex items-center gap-2 px-3 h-full border-r border-border cursor-pointer transition-colors text-sm shrink-0",
								activeFileId === file.id
									? "bg-background text-foreground"
									: "text-muted-foreground hover:bg-muted/50",
							)}
							onClick={() => onTabSelect(file)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									onTabSelect(file);
								}
							}}
						>
							<FileCode
								className={cn(
									"h-4 w-4",
									file.changed ? "text-green-500" : "text-sky-500",
								)}
							/>
							<span className="truncate max-w-32">{file.name}</span>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									onTabClose(file.id);
								}}
								className="hover:bg-muted-foreground/20 rounded p-0.5 transition-colors"
							>
								<X className="h-3.5 w-3.5" />
							</button>
						</div>
					))}
				</div>

				{/* Diff style toggle */}
				<div className="flex items-center gap-2 px-2 shrink-0">
					<div className="flex items-center rounded-md border border-border bg-background">
						<Button
							variant="ghost"
							size="sm"
							className={cn(
								"h-6 px-1.5 rounded-r-none",
								diffStyle === "split" && "bg-muted",
							)}
							onClick={() => setDiffStyle("split")}
							title="Side by side"
						>
							<Columns2 className="h-3.5 w-3.5" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className={cn(
								"h-6 px-1.5 rounded-l-none border-l border-border",
								diffStyle === "unified" && "bg-muted",
							)}
							onClick={() => setDiffStyle("unified")}
							title="Unified"
						>
							<Rows2 className="h-3.5 w-3.5" />
						</Button>
					</div>

					{/* Panel controls */}
					<PanelControls
						state={panelState}
						onMaximize={onMaximize}
						onClose={onClose}
						showClose
						showMinimize={false}
					/>
				</div>
			</div>

			{/* Diff content */}
			{activeFile && <DiffContent file={activeFile} diffStyle={diffStyle} />}
		</div>
	);
}

function DiffContent({
	file,
	diffStyle,
}: {
	file: FileNode;
	diffStyle: DiffStyle;
}) {
	const { selectedSession } = useSessionContext();
	const { resolvedTheme } = useTheme();
	const { diff, isLoading, error } = useSessionFileDiff(
		selectedSession?.id ?? null,
		file.id, // file.id is the file path
	);

	if (isLoading) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground">
				<Loader2 className="h-5 w-5 animate-spin mr-2" />
				Loading diff...
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex-1 flex items-center justify-center text-destructive">
				Failed to load diff: {error.message}
			</div>
		);
	}

	if (!diff) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground">
				No diff available
			</div>
		);
	}

	if (diff.binary) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground">
				Binary file - cannot display diff
			</div>
		);
	}

	if (diff.status === "unchanged") {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground">
				No changes
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-auto">
			<PatchDiff
				patch={diff.patch}
				options={{
					theme: {
						dark: "github-dark",
						light: "github-light",
					},
					themeType: resolvedTheme === "dark" ? "dark" : "light",
					diffStyle,
					lineDiffType: "word-alt",
				}}
			/>
		</div>
	);
}
