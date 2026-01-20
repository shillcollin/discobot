"use client";

import type { PanelState } from "@/components/ide/panel-controls";
import { TabbedDiffView } from "@/components/ide/tabbed-diff-view";
import type { FileNode } from "@/lib/api-types";

interface DiffPanelProps {
	isVisible: boolean;
	panelState: PanelState;
	style: React.CSSProperties;
	openFiles: FileNode[];
	activeFileId: string | null;
	onTabSelect: (file: FileNode) => void;
	onTabClose: (fileId: string) => void;
	onMaximize: () => void;
	onClose: () => void;
}

export function DiffPanel({
	isVisible,
	panelState,
	style,
	openFiles,
	activeFileId,
	onTabSelect,
	onTabClose,
	onMaximize,
	onClose,
}: DiffPanelProps) {
	if (!isVisible) return null;

	return (
		<div
			className="flex flex-col border-b border-border transition-all overflow-hidden"
			style={style}
		>
			<TabbedDiffView
				openFiles={openFiles}
				activeFileId={activeFileId}
				onTabSelect={onTabSelect}
				onTabClose={onTabClose}
				panelState={panelState}
				onMaximize={onMaximize}
				onClose={onClose}
				className="flex-1 overflow-hidden"
				hideEmptyState
			/>
		</div>
	);
}
