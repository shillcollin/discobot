/**
 * Tauri utilities for cross-platform functionality.
 *
 * These utilities provide consistent behavior between Tauri (desktop app)
 * and browser environments.
 */

/**
 * Whether the app is running in Tauri (desktop) mode.
 * This is set at build time via NEXT_PUBLIC_TAURI env var.
 */
export const IS_TAURI = process.env.NEXT_PUBLIC_TAURI === "true";

/**
 * Open a URL in the system's default browser.
 *
 * In Tauri, this uses the shell plugin to launch the external browser.
 * In browser mode, this uses window.open().
 *
 * @param url - The URL to open
 */
export async function openExternal(url: string): Promise<void> {
	if (IS_TAURI) {
		const { open } = await import("@tauri-apps/plugin-shell");
		await open(url);
	} else {
		window.open(url, "_blank", "noopener,noreferrer");
	}
}
