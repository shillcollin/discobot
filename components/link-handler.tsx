import { useEffect } from "react";
import { openUrl } from "@/lib/tauri";

/**
 * LinkHandler - Global click handler for external links
 *
 * Intercepts clicks on anchor tags and uses the appropriate method to open them:
 * - In Tauri: Uses the opener plugin
 * - In browser: Uses window.open for http/https, window.location.href for custom protocols
 *
 * This ensures that links in markdown (from Streamdown) and other components
 * work correctly in both browser and Tauri environments.
 */
export function LinkHandler() {
	useEffect(() => {
		const handleClick = (event: MouseEvent) => {
			// Find the closest anchor tag in the event path
			const anchor = (event.target as HTMLElement).closest("a");

			if (!anchor) return;

			// Only handle links that open in a new window/tab
			const target = anchor.getAttribute("target");
			const href = anchor.getAttribute("href");

			// Skip if no href or if it's a relative link without target="_blank"
			if (!href) return;

			// Handle links that should open externally:
			// 1. Links with target="_blank"
			// 2. External http/https links
			// 3. Custom protocol links (vscode://, cursor://, etc.)
			const isTargetBlank = target === "_blank";
			const isExternalHttp =
				href.startsWith("http://") || href.startsWith("https://");
			const isCustomProtocol =
				!href.startsWith("/") &&
				!href.startsWith("#") &&
				!href.startsWith("http://") &&
				!href.startsWith("https://") &&
				href.includes(":");

			if (isTargetBlank || isExternalHttp || isCustomProtocol) {
				event.preventDefault();
				event.stopPropagation();
				openUrl(href);
			}
		};

		// Add click listener to document
		document.addEventListener("click", handleClick);

		return () => {
			document.removeEventListener("click", handleClick);
		};
	}, []);

	return null;
}
