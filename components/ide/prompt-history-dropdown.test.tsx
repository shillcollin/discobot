import assert from "node:assert";
import { describe, it } from "node:test";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { PromptHistoryDropdown } from "./prompt-history-dropdown";

describe("PromptHistoryDropdown", () => {
	const mockTextareaRef = createRef<HTMLTextAreaElement>();
	const mockSetHistoryIndex = () => {};
	const mockOnSelectHistory = () => {};
	const mockPinPrompt = () => {};
	const mockUnpinPrompt = () => {};
	const mockIsPinned = () => false;
	const mockCloseHistory = () => {};

	it("should not render when isHistoryOpen is false", () => {
		const { container } = render(
			<PromptHistoryDropdown
				history={["prompt 1"]}
				pinnedPrompts={[]}
				historyIndex={-1}
				isPinnedSelection={false}
				isHistoryOpen={false}
				setHistoryIndex={mockSetHistoryIndex}
				onSelectHistory={mockOnSelectHistory}
				pinPrompt={mockPinPrompt}
				unpinPrompt={mockUnpinPrompt}
				isPinned={mockIsPinned}
				textareaRef={mockTextareaRef}
				closeHistory={mockCloseHistory}
			/>,
		);

		assert.strictEqual(container.firstChild, null);
	});

	it("should not render when no history and no pinned prompts", () => {
		const { container } = render(
			<PromptHistoryDropdown
				history={[]}
				pinnedPrompts={[]}
				historyIndex={-1}
				isPinnedSelection={false}
				isHistoryOpen={true}
				setHistoryIndex={mockSetHistoryIndex}
				onSelectHistory={mockOnSelectHistory}
				pinPrompt={mockPinPrompt}
				unpinPrompt={mockUnpinPrompt}
				isPinned={mockIsPinned}
				textareaRef={mockTextareaRef}
				closeHistory={mockCloseHistory}
			/>,
		);

		assert.strictEqual(container.firstChild, null);
	});

	it("should render header with title", () => {
		render(
			<PromptHistoryDropdown
				history={["prompt 1"]}
				pinnedPrompts={[]}
				historyIndex={-1}
				isPinnedSelection={false}
				isHistoryOpen={true}
				setHistoryIndex={mockSetHistoryIndex}
				onSelectHistory={mockOnSelectHistory}
				pinPrompt={mockPinPrompt}
				unpinPrompt={mockUnpinPrompt}
				isPinned={mockIsPinned}
				textareaRef={mockTextareaRef}
				closeHistory={mockCloseHistory}
			/>,
		);

		const title = screen.getByText("Prompt history");
		assert.ok(title);
	});

	it("should render recent history items", () => {
		const { container } = render(
			<PromptHistoryDropdown
				history={["prompt 1", "prompt 2", "prompt 3"]}
				pinnedPrompts={[]}
				historyIndex={-1}
				isPinnedSelection={false}
				isHistoryOpen={true}
				setHistoryIndex={mockSetHistoryIndex}
				onSelectHistory={mockOnSelectHistory}
				pinPrompt={mockPinPrompt}
				unpinPrompt={mockUnpinPrompt}
				isPinned={mockIsPinned}
				textareaRef={mockTextareaRef}
				closeHistory={mockCloseHistory}
			/>,
		);

		const recentItems = container.querySelectorAll("[data-index]");
		assert.strictEqual(recentItems.length, 3);
	});

	it("should render pinned prompts section when pinned prompts exist", () => {
		render(
			<PromptHistoryDropdown
				history={["recent 1"]}
				pinnedPrompts={["pinned 1", "pinned 2"]}
				historyIndex={-1}
				isPinnedSelection={false}
				isHistoryOpen={true}
				setHistoryIndex={mockSetHistoryIndex}
				onSelectHistory={mockOnSelectHistory}
				pinPrompt={mockPinPrompt}
				unpinPrompt={mockUnpinPrompt}
				isPinned={mockIsPinned}
				textareaRef={mockTextareaRef}
				closeHistory={mockCloseHistory}
			/>,
		);

		assert.ok(screen.getByText("Pinned"));
		assert.ok(screen.getByText("pinned 1"));
		assert.ok(screen.getByText("pinned 2"));
	});

	it("should show Recent label when both pinned and recent exist", () => {
		const { container } = render(
			<PromptHistoryDropdown
				history={["recent 1"]}
				pinnedPrompts={["pinned 1"]}
				historyIndex={-1}
				isPinnedSelection={false}
				isHistoryOpen={true}
				setHistoryIndex={mockSetHistoryIndex}
				onSelectHistory={mockOnSelectHistory}
				pinPrompt={mockPinPrompt}
				unpinPrompt={mockUnpinPrompt}
				isPinned={mockIsPinned}
				textareaRef={mockTextareaRef}
				closeHistory={mockCloseHistory}
			/>,
		);

		const labels = container.querySelectorAll(
			".text-xs.font-medium.text-muted-foreground",
		);
		const labelTexts = Array.from(labels).map((l) => l.textContent);
		assert.ok(labelTexts.includes("Recent"));
		assert.ok(labelTexts.includes("Pinned"));
	});

	it("should apply selected styling to pinned item when isPinnedSelection is true", () => {
		const { container } = render(
			<PromptHistoryDropdown
				history={[]}
				pinnedPrompts={["pinned 1", "pinned 2"]}
				historyIndex={1}
				isPinnedSelection={true}
				isHistoryOpen={true}
				setHistoryIndex={mockSetHistoryIndex}
				onSelectHistory={mockOnSelectHistory}
				pinPrompt={mockPinPrompt}
				unpinPrompt={mockUnpinPrompt}
				isPinned={mockIsPinned}
				textareaRef={mockTextareaRef}
				closeHistory={mockCloseHistory}
			/>,
		);

		const pinnedItems = container.querySelectorAll("[data-pinned-index]");
		assert.strictEqual(pinnedItems.length, 2);

		// Second pinned item should have selected styling
		const selectedItem = container.querySelector('[data-pinned-index="1"]');
		assert.ok(selectedItem);
		assert.ok(selectedItem.className.includes("bg-accent"));
	});

	it("should apply selected styling to recent item when isPinnedSelection is false", () => {
		const { container } = render(
			<PromptHistoryDropdown
				history={["recent 1", "recent 2", "recent 3"]}
				pinnedPrompts={[]}
				historyIndex={1}
				isPinnedSelection={false}
				isHistoryOpen={true}
				setHistoryIndex={mockSetHistoryIndex}
				onSelectHistory={mockOnSelectHistory}
				pinPrompt={mockPinPrompt}
				unpinPrompt={mockUnpinPrompt}
				isPinned={mockIsPinned}
				textareaRef={mockTextareaRef}
				closeHistory={mockCloseHistory}
			/>,
		);

		const recentItems = container.querySelectorAll("[data-index]");
		assert.strictEqual(recentItems.length, 3);

		// Second recent item should have selected styling
		const selectedItem = container.querySelector('[data-index="1"]');
		assert.ok(selectedItem);
		assert.ok(selectedItem.className.includes("bg-accent"));
	});

	it("should render pin buttons for recent items", () => {
		const { container } = render(
			<PromptHistoryDropdown
				history={["recent 1"]}
				pinnedPrompts={[]}
				historyIndex={-1}
				isPinnedSelection={false}
				isHistoryOpen={true}
				setHistoryIndex={mockSetHistoryIndex}
				onSelectHistory={mockOnSelectHistory}
				pinPrompt={mockPinPrompt}
				unpinPrompt={mockUnpinPrompt}
				isPinned={mockIsPinned}
				textareaRef={mockTextareaRef}
				closeHistory={mockCloseHistory}
			/>,
		);

		const pinButtons = container.querySelectorAll(
			'[data-index] button[title="Pin"]',
		);
		assert.strictEqual(pinButtons.length, 1);
	});

	it("should render unpin buttons for pinned items", () => {
		const { container } = render(
			<PromptHistoryDropdown
				history={[]}
				pinnedPrompts={["pinned 1", "pinned 2"]}
				historyIndex={-1}
				isPinnedSelection={false}
				isHistoryOpen={true}
				setHistoryIndex={mockSetHistoryIndex}
				onSelectHistory={mockOnSelectHistory}
				pinPrompt={mockPinPrompt}
				unpinPrompt={mockUnpinPrompt}
				isPinned={mockIsPinned}
				textareaRef={mockTextareaRef}
				closeHistory={mockCloseHistory}
			/>,
		);

		const unpinButtons = container.querySelectorAll(
			'[data-pinned-index] button[title="Unpin"]',
		);
		assert.strictEqual(unpinButtons.length, 2);
	});

	it("should limit recent history to MAX_VISIBLE_HISTORY items", () => {
		const MAX_VISIBLE_HISTORY = 20;
		const largeHistory = Array.from({ length: 50 }, (_, i) => `prompt ${i}`);

		const { container } = render(
			<PromptHistoryDropdown
				history={largeHistory}
				pinnedPrompts={[]}
				historyIndex={-1}
				isPinnedSelection={false}
				isHistoryOpen={true}
				setHistoryIndex={mockSetHistoryIndex}
				onSelectHistory={mockOnSelectHistory}
				pinPrompt={mockPinPrompt}
				unpinPrompt={mockUnpinPrompt}
				isPinned={mockIsPinned}
				textareaRef={mockTextareaRef}
				closeHistory={mockCloseHistory}
			/>,
		);

		const recentItems = container.querySelectorAll("[data-index]");
		assert.strictEqual(recentItems.length, MAX_VISIBLE_HISTORY);
	});

	it("should render navigation hint in header", () => {
		const { container } = render(
			<PromptHistoryDropdown
				history={["prompt 1"]}
				pinnedPrompts={[]}
				historyIndex={-1}
				isPinnedSelection={false}
				isHistoryOpen={true}
				setHistoryIndex={mockSetHistoryIndex}
				onSelectHistory={mockOnSelectHistory}
				pinPrompt={mockPinPrompt}
				unpinPrompt={mockUnpinPrompt}
				isPinned={mockIsPinned}
				textareaRef={mockTextareaRef}
				closeHistory={mockCloseHistory}
			/>,
		);

		const hint = container.textContent;
		assert.ok(hint?.includes("to navigate"));
	});

	it("should apply correct border classes to sections", () => {
		const { container } = render(
			<PromptHistoryDropdown
				history={["recent 1"]}
				pinnedPrompts={["pinned 1"]}
				historyIndex={-1}
				isPinnedSelection={false}
				isHistoryOpen={true}
				setHistoryIndex={mockSetHistoryIndex}
				onSelectHistory={mockOnSelectHistory}
				pinPrompt={mockPinPrompt}
				unpinPrompt={mockUnpinPrompt}
				isPinned={mockIsPinned}
				textareaRef={mockTextareaRef}
				closeHistory={mockCloseHistory}
			/>,
		);

		// Pinned section should have border-t (top border) since it's at the bottom
		const pinnedSection = container.querySelector(".border-t");
		assert.ok(pinnedSection);
	});

	it("should render pinned items in reverse order", () => {
		const { container } = render(
			<PromptHistoryDropdown
				history={[]}
				pinnedPrompts={["first", "second", "third"]}
				historyIndex={-1}
				isPinnedSelection={false}
				isHistoryOpen={true}
				setHistoryIndex={mockSetHistoryIndex}
				onSelectHistory={mockOnSelectHistory}
				pinPrompt={mockPinPrompt}
				unpinPrompt={mockUnpinPrompt}
				isPinned={mockIsPinned}
				textareaRef={mockTextareaRef}
				closeHistory={mockCloseHistory}
			/>,
		);

		// Check that parent container has flex-col-reverse
		const pinnedContainer = container.querySelector(".flex.flex-col-reverse");
		assert.ok(pinnedContainer);
	});
});
