import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Format a timestamp as a human-readable relative time (e.g., "2 minutes ago")
 */
export function formatTimeAgo(timestamp: string): string {
	const date = new Date(timestamp);
	const now = new Date();
	const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (seconds < 60) {
		return "just now";
	}

	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) {
		return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
	}

	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
	}

	const days = Math.floor(hours / 24);
	if (days < 7) {
		return days === 1 ? "1 day ago" : `${days} days ago`;
	}

	const weeks = Math.floor(days / 7);
	if (weeks < 4) {
		return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
	}

	const months = Math.floor(days / 30);
	if (months < 12) {
		return months === 1 ? "1 month ago" : `${months} months ago`;
	}

	const years = Math.floor(days / 365);
	return years === 1 ? "1 year ago" : `${years} years ago`;
}
