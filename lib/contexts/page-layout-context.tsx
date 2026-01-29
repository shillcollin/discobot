import * as React from "react";
import {
	STORAGE_KEYS,
	usePersistedState,
} from "@/lib/hooks/use-persisted-state";

const LEFT_SIDEBAR_DEFAULT_WIDTH = 256;
const LEFT_SIDEBAR_MIN_WIDTH = 180;
const LEFT_SIDEBAR_MAX_WIDTH = 480;

export interface PageLayoutContextValue {
	// Left sidebar
	leftSidebarOpen: boolean;
	leftSidebarWidth: number;
	setLeftSidebarOpen: (open: boolean) => void;
	handleLeftSidebarResize: (delta: number) => void;
}

const PageLayoutContext = React.createContext<PageLayoutContextValue | null>(
	null,
);

export function usePageLayoutContext() {
	const context = React.useContext(PageLayoutContext);
	if (!context) {
		throw new Error(
			"usePageLayoutContext must be used within a PageLayoutProvider",
		);
	}
	return context;
}

interface PageLayoutProviderProps {
	children: React.ReactNode;
}

export function PageLayoutProvider({ children }: PageLayoutProviderProps) {
	const [leftSidebarOpen, setLeftSidebarOpen] = usePersistedState(
		STORAGE_KEYS.LEFT_SIDEBAR_OPEN,
		false,
	);
	const [leftSidebarWidth, setLeftSidebarWidth] = usePersistedState(
		STORAGE_KEYS.LEFT_SIDEBAR_WIDTH,
		LEFT_SIDEBAR_DEFAULT_WIDTH,
	);

	const handleLeftSidebarResize = React.useCallback(
		(delta: number) => {
			setLeftSidebarWidth((prev) =>
				Math.min(
					LEFT_SIDEBAR_MAX_WIDTH,
					Math.max(LEFT_SIDEBAR_MIN_WIDTH, prev + delta),
				),
			);
		},
		[setLeftSidebarWidth],
	);

	const value = React.useMemo<PageLayoutContextValue>(
		() => ({
			leftSidebarOpen,
			leftSidebarWidth,
			setLeftSidebarOpen,
			handleLeftSidebarResize,
		}),
		[
			leftSidebarOpen,
			leftSidebarWidth,
			setLeftSidebarOpen,
			handleLeftSidebarResize,
		],
	);

	return (
		<PageLayoutContext.Provider value={value}>
			{children}
		</PageLayoutContext.Provider>
	);
}
