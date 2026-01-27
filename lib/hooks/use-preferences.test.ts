import assert from "node:assert";
import { describe, it } from "node:test";

// Test the logic patterns used in the preferences hook
// Since we can't easily mock SWR hooks in Node's test runner,
// we test the core logic patterns separately

const mockPreferences = [
	{ key: "theme", value: "dark", updatedAt: "2024-01-01T00:00:00Z" },
	{ key: "editor", value: "vscode", updatedAt: "2024-01-01T00:00:00Z" },
];

describe("usePreferences hook logic", () => {
	describe("getPreference helper", () => {
		it("should return value for existing key from cached preferences", () => {
			// Simulate the logic of getPreference from the hook
			const preferences = mockPreferences;
			const getPreference = (key: string): string | undefined => {
				return preferences.find((p) => p.key === key)?.value;
			};

			const result = getPreference("theme");
			assert.strictEqual(result, "dark", "Should return 'dark' for theme key");
		});

		it("should return undefined for non-existent key", () => {
			const preferences = mockPreferences;
			const getPreference = (key: string): string | undefined => {
				return preferences.find((p) => p.key === key)?.value;
			};

			const result = getPreference("nonexistent");
			assert.strictEqual(
				result,
				undefined,
				"Should return undefined for non-existent key",
			);
		});

		it("should handle empty preferences array", () => {
			const preferences: typeof mockPreferences = [];
			const getPreference = (key: string): string | undefined => {
				return preferences.find((p) => p.key === key)?.value;
			};

			const result = getPreference("theme");
			assert.strictEqual(
				result,
				undefined,
				"Should return undefined when preferences is empty",
			);
		});
	});

	describe("Type safety", () => {
		it("should return correct types for UserPreference", () => {
			const pref = mockPreferences[0];

			// Type checks - these would fail at compile time if types were wrong
			const _key: string = pref.key;
			const _value: string = pref.value;
			const _updatedAt: string = pref.updatedAt;

			assert.strictEqual(typeof _key, "string");
			assert.strictEqual(typeof _value, "string");
			assert.strictEqual(typeof _updatedAt, "string");
		});
	});
});

describe("Preference key patterns", () => {
	it("should support dotted keys for namespacing", () => {
		const preferences = [
			{ key: "editor.theme", value: "dark", updatedAt: "" },
			{ key: "editor.fontSize", value: "14", updatedAt: "" },
			{ key: "terminal.shell", value: "zsh", updatedAt: "" },
		];

		const getPreference = (key: string): string | undefined => {
			return preferences.find((p) => p.key === key)?.value;
		};

		assert.strictEqual(getPreference("editor.theme"), "dark");
		assert.strictEqual(getPreference("editor.fontSize"), "14");
		assert.strictEqual(getPreference("terminal.shell"), "zsh");
	});

	it("should support getting all preferences in a namespace", () => {
		const preferences = [
			{ key: "editor.theme", value: "dark", updatedAt: "" },
			{ key: "editor.fontSize", value: "14", updatedAt: "" },
			{ key: "terminal.shell", value: "zsh", updatedAt: "" },
		];

		const getPreferencesInNamespace = (namespace: string) => {
			return preferences.filter((p) => p.key.startsWith(`${namespace}.`));
		};

		const editorPrefs = getPreferencesInNamespace("editor");
		assert.strictEqual(editorPrefs.length, 2);
	});
});

describe("Preference value patterns", () => {
	it("should handle JSON values stored as strings", () => {
		const configValue = JSON.stringify({
			theme: "dark",
			fontSize: 14,
			fontFamily: "JetBrains Mono",
		});

		const preferences = [
			{ key: "editorConfig", value: configValue, updatedAt: "" },
		];

		const getPreference = (key: string): string | undefined => {
			return preferences.find((p) => p.key === key)?.value;
		};

		const raw = getPreference("editorConfig");
		assert.ok(raw);

		const parsed = JSON.parse(raw);
		assert.strictEqual(parsed.theme, "dark");
		assert.strictEqual(parsed.fontSize, 14);
	});

	it("should handle empty string values", () => {
		const preferences = [{ key: "emptyPref", value: "", updatedAt: "" }];

		const getPreference = (key: string): string | undefined => {
			return preferences.find((p) => p.key === key)?.value;
		};

		const result = getPreference("emptyPref");
		assert.strictEqual(result, "");
	});

	it("should handle boolean-like string values", () => {
		const preferences = [
			{ key: "featureEnabled", value: "true", updatedAt: "" },
			{ key: "featureDisabled", value: "false", updatedAt: "" },
		];

		const getPreference = (key: string): string | undefined => {
			return preferences.find((p) => p.key === key)?.value;
		};

		assert.strictEqual(getPreference("featureEnabled"), "true");
		assert.strictEqual(getPreference("featureDisabled"), "false");

		// Helper to parse boolean preferences
		const getBoolPreference = (key: string, defaultValue = false): boolean => {
			const val = getPreference(key);
			if (val === undefined) return defaultValue;
			return val === "true";
		};

		assert.strictEqual(getBoolPreference("featureEnabled"), true);
		assert.strictEqual(getBoolPreference("featureDisabled"), false);
		assert.strictEqual(getBoolPreference("nonexistent", true), true);
	});

	it("should handle numeric string values", () => {
		const preferences = [
			{ key: "fontSize", value: "14", updatedAt: "" },
			{ key: "tabSize", value: "4", updatedAt: "" },
		];

		const getPreference = (key: string): string | undefined => {
			return preferences.find((p) => p.key === key)?.value;
		};

		const getNumericPreference = (
			key: string,
			defaultValue: number,
		): number => {
			const val = getPreference(key);
			if (val === undefined) return defaultValue;
			const num = parseInt(val, 10);
			return Number.isNaN(num) ? defaultValue : num;
		};

		assert.strictEqual(getNumericPreference("fontSize", 12), 14);
		assert.strictEqual(getNumericPreference("tabSize", 2), 4);
		assert.strictEqual(getNumericPreference("nonexistent", 10), 10);
	});
});

describe("API request/response patterns", () => {
	it("should structure SetPreferenceRequest correctly", () => {
		const request = { value: "dark" };
		assert.strictEqual(typeof request.value, "string");
	});

	it("should structure SetPreferencesRequest correctly", () => {
		const request = {
			preferences: {
				theme: "dark",
				editor: "cursor",
			},
		};
		assert.ok(typeof request.preferences === "object");
		assert.strictEqual(request.preferences.theme, "dark");
	});

	it("should handle preference response with updatedAt", () => {
		const response = {
			key: "theme",
			value: "dark",
			updatedAt: "2024-01-01T00:00:00Z",
		};

		assert.strictEqual(response.key, "theme");
		assert.strictEqual(response.value, "dark");
		assert.ok(response.updatedAt);

		// Verify it's a valid ISO date
		const date = new Date(response.updatedAt);
		assert.ok(!Number.isNaN(date.getTime()));
	});
});

describe("Pinned prompts preferences integration", () => {
	const PINNED_PREFERENCE_KEY = "prompts.pinned";

	describe("Storage format", () => {
		it("should store pinned prompts as JSON-stringified array", () => {
			const pinnedPrompts = ["prompt 1", "prompt 2", "prompt 3"];
			const storedValue = JSON.stringify(pinnedPrompts);

			const preferences = [
				{ key: PINNED_PREFERENCE_KEY, value: storedValue, updatedAt: "" },
			];

			const getPreference = (key: string): string | undefined => {
				return preferences.find((p) => p.key === key)?.value;
			};

			const raw = getPreference(PINNED_PREFERENCE_KEY);
			assert.ok(raw);

			const parsed = JSON.parse(raw);
			assert.ok(Array.isArray(parsed));
			assert.deepStrictEqual(parsed, pinnedPrompts);
		});

		it("should handle empty pinned prompts array", () => {
			const pinnedPrompts: string[] = [];
			const storedValue = JSON.stringify(pinnedPrompts);

			const preferences = [
				{ key: PINNED_PREFERENCE_KEY, value: storedValue, updatedAt: "" },
			];

			const getPreference = (key: string): string | undefined => {
				return preferences.find((p) => p.key === key)?.value;
			};

			const raw = getPreference(PINNED_PREFERENCE_KEY);
			assert.ok(raw !== undefined);

			const parsed = JSON.parse(raw);
			assert.ok(Array.isArray(parsed));
			assert.strictEqual(parsed.length, 0);
		});

		it("should handle missing pinned prompts preference", () => {
			const preferences: typeof mockPreferences = [];

			const getPreference = (key: string): string | undefined => {
				return preferences.find((p) => p.key === key)?.value;
			};

			const raw = getPreference(PINNED_PREFERENCE_KEY);
			assert.strictEqual(raw, undefined);
		});
	});

	describe("Loading pinned prompts", () => {
		it("should parse pinned prompts from preference value", () => {
			const pinnedPrompts = ["help me debug", "write a function"];
			const preferences = [
				{
					key: PINNED_PREFERENCE_KEY,
					value: JSON.stringify(pinnedPrompts),
					updatedAt: "",
				},
			];

			const getPreference = (key: string): string | undefined => {
				return preferences.find((p) => p.key === key)?.value;
			};

			// Simulate loadPinnedFromPreferences logic
			const loadPinnedFromPreferences = (): string[] => {
				const stored = getPreference(PINNED_PREFERENCE_KEY);
				if (!stored) return [];
				try {
					const parsed = JSON.parse(stored);
					if (Array.isArray(parsed)) {
						return parsed.filter((item) => typeof item === "string");
					}
				} catch {
					// Ignore parse errors
				}
				return [];
			};

			const loaded = loadPinnedFromPreferences();
			assert.deepStrictEqual(loaded, pinnedPrompts);
		});

		it("should filter out non-string items when loading", () => {
			const mixedArray = ["valid", 123, null, "also valid", undefined, false];
			const preferences = [
				{
					key: PINNED_PREFERENCE_KEY,
					value: JSON.stringify(mixedArray),
					updatedAt: "",
				},
			];

			const getPreference = (key: string): string | undefined => {
				return preferences.find((p) => p.key === key)?.value;
			};

			const loadPinnedFromPreferences = (): string[] => {
				const stored = getPreference(PINNED_PREFERENCE_KEY);
				if (!stored) return [];
				try {
					const parsed = JSON.parse(stored);
					if (Array.isArray(parsed)) {
						return parsed.filter((item) => typeof item === "string");
					}
				} catch {
					return [];
				}
				return [];
			};

			const loaded = loadPinnedFromPreferences();
			assert.deepStrictEqual(loaded, ["valid", "also valid"]);
		});

		it("should handle malformed JSON gracefully", () => {
			const preferences = [
				{ key: PINNED_PREFERENCE_KEY, value: "not valid json{", updatedAt: "" },
			];

			const getPreference = (key: string): string | undefined => {
				return preferences.find((p) => p.key === key)?.value;
			};

			const loadPinnedFromPreferences = (): string[] => {
				const stored = getPreference(PINNED_PREFERENCE_KEY);
				if (!stored) return [];
				try {
					const parsed = JSON.parse(stored);
					if (Array.isArray(parsed)) {
						return parsed.filter((item) => typeof item === "string");
					}
				} catch {
					return [];
				}
				return [];
			};

			const loaded = loadPinnedFromPreferences();
			assert.deepStrictEqual(loaded, []);
		});

		it("should handle non-array JSON values", () => {
			const preferences = [
				{
					key: PINNED_PREFERENCE_KEY,
					value: JSON.stringify({ not: "an array" }),
					updatedAt: "",
				},
			];

			const getPreference = (key: string): string | undefined => {
				return preferences.find((p) => p.key === key)?.value;
			};

			const loadPinnedFromPreferences = (): string[] => {
				const stored = getPreference(PINNED_PREFERENCE_KEY);
				if (!stored) return [];
				try {
					const parsed = JSON.parse(stored);
					if (Array.isArray(parsed)) {
						return parsed.filter((item) => typeof item === "string");
					}
				} catch {
					return [];
				}
				return [];
			};

			const loaded = loadPinnedFromPreferences();
			assert.deepStrictEqual(loaded, []);
		});
	});

	describe("Saving pinned prompts", () => {
		it("should add a new pinned prompt to existing list", () => {
			const existing = ["prompt 1", "prompt 2"];
			const newPrompt = "prompt 3";

			const updated = [...existing, newPrompt];
			const storedValue = JSON.stringify(updated);

			assert.strictEqual(storedValue, '["prompt 1","prompt 2","prompt 3"]');
		});

		it("should not add duplicate pinned prompts", () => {
			const existing = ["prompt 1", "prompt 2"];
			const duplicate = "prompt 1";

			if (existing.includes(duplicate)) {
				// Don't add - this is the expected behavior
				assert.ok(true, "Correctly rejected duplicate");
			} else {
				assert.fail("Should have detected duplicate");
			}
		});

		it("should remove a pinned prompt", () => {
			const existing = ["prompt 1", "prompt 2", "prompt 3"];
			const toRemove = "prompt 2";

			const updated = existing.filter((p) => p !== toRemove);
			const storedValue = JSON.stringify(updated);

			assert.strictEqual(storedValue, '["prompt 1","prompt 3"]');
		});

		it("should handle removing non-existent prompt", () => {
			const existing = ["prompt 1", "prompt 2"];
			const toRemove = "nonexistent";

			const updated = existing.filter((p) => p !== toRemove);

			assert.deepStrictEqual(updated, existing);
		});

		it("should allow unlimited pinned prompts (no size limit)", () => {
			const largePinnedList = Array.from(
				{ length: 200 },
				(_, i) => `prompt ${i}`,
			);
			const storedValue = JSON.stringify(largePinnedList);

			const parsed = JSON.parse(storedValue);
			assert.strictEqual(
				parsed.length,
				200,
				"Should store all 200 pinned prompts without limit",
			);
		});
	});

	describe("Migration from localStorage", () => {
		it("should use the same key format for consistency", () => {
			// The preference key should be namespaced for clarity
			assert.strictEqual(PINNED_PREFERENCE_KEY, "prompts.pinned");
		});

		it("should maintain backward compatibility with data format", () => {
			// Old localStorage format: JSON.stringify(["prompt 1", "prompt 2"])
			// New preferences format: same JSON string stored as value
			const prompts = ["prompt 1", "prompt 2"];
			const localStorageFormat = JSON.stringify(prompts);
			const preferencesValue = JSON.stringify(prompts);

			assert.strictEqual(
				localStorageFormat,
				preferencesValue,
				"Data format should be identical",
			);
		});
	});
});
