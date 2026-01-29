import { Loader2 } from "lucide-react";
import {
	Queue,
	QueueItem,
	QueueItemContent,
	QueueItemDescription,
	QueueItemIndicator,
	QueueList,
	QueueSection,
	QueueSectionContent,
	QueueSectionLabel,
	QueueSectionTrigger,
} from "@/components/ai-elements/queue";
import { cn } from "@/lib/utils";

// Plan entry structure from TodoWrite tool
export interface PlanEntry {
	content: string;
	status: "pending" | "in_progress" | "completed";
	priority?: "low" | "medium" | "high";
}

interface ChatPlanQueueProps {
	/** The current plan entries */
	plan: PlanEntry[];
}

/**
 * ChatPlanQueue - Displays the current todo/plan queue
 * Shows active plan with status indicators
 */
export function ChatPlanQueue({ plan }: ChatPlanQueueProps) {
	const completedCount = plan.filter((e) => e.status === "completed").length;

	return (
		<Queue className="border-t border-x-0 border-b-0 rounded-none shadow-none">
			<QueueSection>
				<QueueSectionTrigger>
					<QueueSectionLabel
						count={plan.length}
						label={`Todo (${completedCount} completed)`}
					/>
				</QueueSectionTrigger>
				<QueueSectionContent>
					<QueueList>
						{plan.map((entry, index) => {
							const isCompleted = entry.status === "completed";
							const isInProgress = entry.status === "in_progress";

							return (
								<QueueItem
									// biome-ignore lint/suspicious/noArrayIndexKey: Plan entries don't have unique IDs
									key={index}
									className={cn(isInProgress && "bg-blue-500/10")}
								>
									<div className="flex items-center gap-2">
										{isInProgress ? (
											<Loader2 className="h-3 w-3 text-blue-500 animate-spin shrink-0" />
										) : (
											<QueueItemIndicator completed={isCompleted} />
										)}
										<QueueItemContent completed={isCompleted}>
											{entry.content}
										</QueueItemContent>
									</div>
									{entry.priority && (
										<QueueItemDescription completed={isCompleted}>
											Priority: {entry.priority}
										</QueueItemDescription>
									)}
								</QueueItem>
							);
						})}
					</QueueList>
				</QueueSectionContent>
			</QueueSection>
		</Queue>
	);
}
