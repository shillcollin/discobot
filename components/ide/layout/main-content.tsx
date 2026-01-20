"use client";

import * as React from "react";
import { ChatPanel } from "@/components/ide/chat-panel";
import { FilePanel } from "@/components/ide/file-panel";
import { ResizeHandle } from "@/components/ide/resize-handle";
import type { FileNode, FileStatus } from "@/lib/api-types";
import { useSessionContext } from "@/lib/contexts/session-context";
import { usePanelLayout } from "@/lib/hooks/use-panel-layout";
import { useSessionFiles } from "@/lib/hooks/use-session-files";
import { BottomPanel } from "./bottom-panel";
import { DiffPanel } from "./diff-panel";

type BottomView = "chat" | "terminal";

interface MainContentProps {
	rightSidebarOpen?: boolean;
	rightSidebarWidth?: number;
	onToggleRightSidebar?: () => void;
	onRightSidebarResize?: (delta: number) => void;
	onDiffMaximizeChange?: (isMaximized: boolean) => void;
}

/**
 * Create a minimal FileNode from a file path and optional status.
 * The diff view will fetch actual content via hooks.
 */
function createFileNodeFromPath(path: string, status?: FileStatus): FileNode {
	const name = path.split("/").pop() || path;
	return {
		id: path, // Use path as ID for now
		name,
		type: "file",
		changed: true, // Mark as changed since we're showing it in diff view
		status,
	};
}

export function MainContent({
	rightSidebarOpen = true,
	rightSidebarWidth = 224,
	onToggleRightSidebar,
	onRightSidebarResize,
	onDiffMaximizeChange,
}: MainContentProps) {
	const { selectedSession, chatResetTrigger } = useSessionContext();

	const [bottomView, setBottomView] = React.useState<BottomView>("chat");
	const [openFiles, setOpenFiles] = React.useState<FileNode[]>([]);
	const [activeFilePath, setActiveFilePath] = React.useState<string | null>(
		null,
	);

	// Panel layout hook - now internal to MainContent
	const panelLayout = usePanelLayout();

	// Get changed files count for the bottom panel toggle
	const { diffStats, changedFiles, diffEntries } = useSessionFiles(
		selectedSession?.id ?? null,
		false, // Only need changed files, not full tree
	);
	const changedCount = diffStats?.filesChanged ?? changedFiles.length;

	// Build a map of file path to status for quick lookup
	const statusMap = React.useMemo(() => {
		const map = new Map<string, FileStatus>();
		for (const entry of diffEntries) {
			map.set(entry.path, entry.status);
		}
		return map;
	}, [diffEntries]);

	// Track previous maximize state to detect changes
	const prevDiffMaximized = React.useRef(
		panelLayout.diffPanelState === "maximized",
	);

	// Notify parent when diff maximize state changes
	React.useEffect(() => {
		const isMaximized = panelLayout.diffPanelState === "maximized";
		if (isMaximized !== prevDiffMaximized.current) {
			prevDiffMaximized.current = isMaximized;
			onDiffMaximizeChange?.(isMaximized);
		}
	}, [panelLayout.diffPanelState, onDiffMaximizeChange]);

	// Destructure stable handlers for use in effects
	const { handleCloseDiffPanel, resetPanels, showDiff } = panelLayout;

	// Reset files when session changes
	const prevSessionId = React.useRef<string | null>(null);
	React.useEffect(() => {
		if (selectedSession?.id !== prevSessionId.current) {
			setOpenFiles([]);
			setActiveFilePath(null);
			handleCloseDiffPanel();
			resetPanels();
			prevSessionId.current = selectedSession?.id ?? null;
		}
	}, [selectedSession?.id, handleCloseDiffPanel, resetPanels]);

	const handleFileSelect = React.useCallback(
		(path: string) => {
			// Get the status from the diff entries
			const status = statusMap.get(path);
			// Create a FileNode from the path for the diff view
			const fileNode = createFileNodeFromPath(path, status);
			setOpenFiles((prev) => {
				if (!prev.find((f) => f.id === path)) {
					return [...prev, fileNode];
				}
				return prev;
			});
			setActiveFilePath(path);
			showDiff();
		},
		[showDiff, statusMap],
	);

	const handleTabClose = React.useCallback(
		(fileId: string) => {
			setOpenFiles((prev) => {
				const newOpenFiles = prev.filter((f) => f.id !== fileId);

				if (activeFilePath === fileId) {
					if (newOpenFiles.length > 0) {
						setActiveFilePath(newOpenFiles[newOpenFiles.length - 1].id);
					} else {
						setActiveFilePath(null);
						handleCloseDiffPanel();
					}
				}

				return newOpenFiles;
			});
		},
		[activeFilePath, handleCloseDiffPanel],
	);

	const handleTabSelect = React.useCallback((file: FileNode) => {
		setActiveFilePath(file.id);
	}, []);

	const handleDiffClose = React.useCallback(() => {
		setOpenFiles([]);
		setActiveFilePath(null);
		handleCloseDiffPanel();
	}, [handleCloseDiffPanel]);

	// Computed
	const showCenteredChat = selectedSession === null;
	const showFilePanel = selectedSession !== null;

	if (showCenteredChat) {
		return (
			<main className="flex-1 flex items-center justify-center overflow-hidden">
				<ChatPanel key={chatResetTrigger} className="w-full h-full" />
			</main>
		);
	}

	return (
		<>
			<main
				ref={panelLayout.mainRef}
				className="flex-1 flex flex-col overflow-hidden"
			>
				{/* Top: Diff panel with tabs (when files are open) */}
				<DiffPanel
					isVisible={panelLayout.showDiffPanel}
					panelState={panelLayout.diffPanelState}
					style={panelLayout.getDiffPanelStyle()}
					openFiles={openFiles}
					activeFileId={activeFilePath}
					onTabSelect={handleTabSelect}
					onTabClose={handleTabClose}
					onMaximize={panelLayout.handleDiffMaximize}
					onClose={handleDiffClose}
				/>

				{panelLayout.showResizeHandle && (
					<ResizeHandle onResize={panelLayout.handleResize} />
				)}

				<BottomPanel
					panelState={panelLayout.bottomPanelState}
					style={panelLayout.getBottomPanelStyle()}
					showPanelControls={panelLayout.showDiffPanel}
					view={bottomView}
					onViewChange={setBottomView}
					onMinimize={panelLayout.handleBottomMinimize}
					rightSidebarOpen={rightSidebarOpen}
					onToggleRightSidebar={onToggleRightSidebar}
					changedFilesCount={changedCount}
				/>
			</main>

			{/* Right - File panel (only show when session is selected) */}
			{showFilePanel && rightSidebarOpen && (
				<>
					<ResizeHandle
						orientation="vertical"
						onResize={onRightSidebarResize ?? (() => {})}
					/>
					<FilePanel
						sessionId={selectedSession?.id ?? null}
						onFileSelect={handleFileSelect}
						selectedFilePath={activeFilePath}
						className="overflow-hidden"
						style={{ width: rightSidebarWidth }}
					/>
				</>
			)}
		</>
	);
}
