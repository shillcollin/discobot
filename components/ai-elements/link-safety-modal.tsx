import { Copy, ExternalLinkIcon, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { openUrl } from "@/lib/tauri";

interface LinkSafetyModalProps {
	url: string;
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
}

/**
 * Custom link safety modal for Streamdown that works with Tauri
 *
 * This replaces Streamdown's default modal which uses window.open.
 * Instead, it uses the openUrl utility which works in both browser and Tauri.
 */
export function LinkSafetyModal({
	url,
	isOpen,
	onClose,
}: LinkSafetyModalProps) {
	const [copied, setCopied] = useState(false);

	if (!isOpen) return null;

	const handleCopyLink = async () => {
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (error) {
			console.error("Failed to copy link:", error);
		}
	};

	const handleOpenLink = () => {
		openUrl(url);
		onClose();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div className="relative mx-4 flex w-full max-w-md flex-col gap-4 rounded-xl border bg-background p-6 shadow-lg">
				{/* Close button */}
				<button
					className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
					title="Close"
					type="button"
					onClick={onClose}
				>
					<X className="h-4 w-4" />
				</button>

				{/* Header */}
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-2 font-semibold text-lg">
						<ExternalLinkIcon className="h-5 w-5" />
						<span>Open external link?</span>
					</div>
					<p className="text-muted-foreground text-sm">
						You're about to visit an external website.
					</p>
				</div>

				{/* URL display */}
				<div className="break-all rounded-md bg-muted p-3 font-mono text-sm">
					{url}
				</div>

				{/* Actions */}
				<div className="flex gap-2">
					<Button variant="outline" className="flex-1" onClick={handleCopyLink}>
						<Copy className="h-4 w-4 mr-2" />
						<span>{copied ? "Copied!" : "Copy link"}</span>
					</Button>
					<Button className="flex-1" onClick={handleOpenLink}>
						<ExternalLinkIcon className="h-4 w-4 mr-2" />
						<span>Open link</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
