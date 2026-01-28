import { DiscobotLogo } from "@/components/ide/discobot-logo";
import { cn } from "@/lib/utils";

interface DiscobotBrandProps {
	/** Size of the logo in pixels */
	logoSize?: number;
	/** Text size class (e.g., "text-2xl", "text-base") */
	textSize?: string;
	/** Additional className for the container */
	className?: string;
	/** Additional className for the logo */
	logoClassName?: string;
}

/**
 * Discobot brand component - combines logo and gradient text
 * Uses the #14 styling: bold all caps with purple-pink gradient
 */
export function DiscobotBrand({
	logoSize = 22,
	textSize = "text-base",
	className,
	logoClassName,
}: DiscobotBrandProps) {
	return (
		<div className={cn("flex items-center gap-1 shrink-0", className)}>
			<DiscobotLogo
				size={logoSize}
				className={cn("text-purple-500", logoClassName)}
			/>
			<span
				className={cn(
					"font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent",
					textSize,
				)}
			>
				DISCOBOT
			</span>
		</div>
	);
}
