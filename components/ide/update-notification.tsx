import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function UpdateNotification() {
	const [updateAvailable, setUpdateAvailable] = useState(false);
	const [update, setUpdate] = useState<Update | null>(null);
	const [updating, setUpdating] = useState(false);
	const [downloadProgress, setDownloadProgress] = useState<number>(0);
	const [totalBytes, setTotalBytes] = useState<number>(0);
	const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
	const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

	// Use ref to avoid circular dependency between handleUpdate and checkForUpdate
	const handleUpdateRef = useRef<(() => Promise<void>) | null>(null);

	const handleUpdate = useCallback(async () => {
		if (!update) return;

		try {
			setUpdating(true);
			setDownloadProgress(0);
			setDownloadedBytes(0);
			setTotalBytes(0);

			toast.info("Starting download...");

			let currentTotal = 0;
			let currentDownloaded = 0;

			// Download and install
			await update.downloadAndInstall((progress) => {
				if (progress.event === "Started") {
					const contentLength = progress.data.contentLength || 0;
					currentTotal = contentLength;
					setTotalBytes(contentLength);
					console.log(`Download started, total size: ${contentLength} bytes`);
				} else if (progress.event === "Progress") {
					currentDownloaded += progress.data.chunkLength;
					setDownloadedBytes(currentDownloaded);
					if (currentTotal > 0) {
						const percent = Math.round(
							(currentDownloaded / currentTotal) * 100,
						);
						setDownloadProgress(percent);
					}
					console.log(`Downloaded ${progress.data.chunkLength} bytes`);
				}
			});

			toast.success("Update installed! Restarting...");

			// Restart the app
			await relaunch();
		} catch (error) {
			console.error("Update failed:", error);
			toast.error("Update failed. Please try again.");
		} finally {
			setUpdating(false);
		}
	}, [update]);

	// Update ref when handleUpdate changes
	useEffect(() => {
		handleUpdateRef.current = handleUpdate;
	}, [handleUpdate]);

	const checkForUpdate = useCallback(async () => {
		try {
			const updateInfo = await check();
			if (updateInfo?.available) {
				// Don't show if user already dismissed this version
				if (dismissedVersion === updateInfo.version) {
					return;
				}

				setUpdateAvailable(true);
				setUpdate(updateInfo);

				toast.info(`Update available: v${updateInfo.version}`, {
					action: {
						label: "Update Now",
						onClick: () => handleUpdateRef.current?.(),
					},
					duration: Number.POSITIVE_INFINITY, // Don't auto-dismiss
				});
			}
		} catch (error) {
			console.error("Failed to check for updates:", error);
		}
	}, [dismissedVersion]);

	useEffect(() => {
		// Check for updates on mount and every 30 minutes
		checkForUpdate();
		const interval = setInterval(checkForUpdate, 30 * 60 * 1000);
		return () => clearInterval(interval);
	}, [checkForUpdate]);

	// Only render when update is available
	if (!updateAvailable || !update) return null;

	return (
		<div className="fixed bottom-4 right-4 p-4 bg-background border rounded-lg shadow-lg z-50 min-w-80">
			<p className="text-sm font-medium">Update Available: v{update.version}</p>
			<p className="text-xs text-muted-foreground mb-3">
				A new version of Discobot is ready to install
			</p>

			{updating && downloadProgress > 0 && (
				<div className="mb-3">
					<div className="flex justify-between text-xs text-muted-foreground mb-1">
						<span>Downloading...</span>
						<span>{downloadProgress}%</span>
					</div>
					<div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
						<div
							className="h-full bg-primary transition-all duration-300"
							style={{ width: `${downloadProgress}%` }}
						/>
					</div>
					<div className="text-xs text-muted-foreground mt-1">
						{(downloadedBytes / 1024 / 1024).toFixed(1)} MB /{" "}
						{(totalBytes / 1024 / 1024).toFixed(1)} MB
					</div>
				</div>
			)}

			<div className="flex gap-2">
				<Button size="sm" onClick={handleUpdate} disabled={updating}>
					{updating ? "Updating..." : "Update Now"}
				</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={() => {
						setDismissedVersion(update.version);
						setUpdateAvailable(false);
					}}
					disabled={updating}
				>
					Later
				</Button>
			</div>
		</div>
	);
}
