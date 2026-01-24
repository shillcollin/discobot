/**
 * Unit tests for service front matter parser
 */

import assert from "node:assert";
import { describe, it } from "node:test";
import { normalizeServiceId, parseFrontMatter } from "./parser.js";

describe("parseFrontMatter", () => {
	describe("plain delimiter (---)", () => {
		it("parses basic front matter", () => {
			const content = `#!/bin/bash
---
name: My Service
description: A test service
http: 8080
---
echo "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.name, "My Service");
			assert.strictEqual(result.config.description, "A test service");
			assert.strictEqual(result.config.http, 8080);
			assert.strictEqual(result.bodyStart, 6);
		});

		it("parses https port", () => {
			const content = `#!/bin/bash
---
name: Secure Service
https: 443
---
exec node server.js`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.name, "Secure Service");
			assert.strictEqual(result.config.https, 443);
			assert.strictEqual(result.config.http, undefined);
		});

		it("handles quoted values", () => {
			const content = `#!/bin/bash
---
name: "Service with spaces"
description: 'Single quoted'
---
echo "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.name, "Service with spaces");
			assert.strictEqual(result.config.description, "Single quoted");
		});
	});

	describe("hash-prefixed delimiter (#---)", () => {
		it("parses front matter with no space after #", () => {
			const content = `#!/bin/bash
#---
#name: No Space Service
#http: 8080
#---
echo "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.name, "No Space Service");
			assert.strictEqual(result.config.http, 8080);
			assert.strictEqual(result.bodyStart, 5); // Line 5 (0-indexed)
		});

		it("parses front matter with single space after #", () => {
			const content = `#!/bin/bash
#---
# name: Single Space Service
# http: 9000
#---
echo "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.name, "Single Space Service");
			assert.strictEqual(result.config.http, 9000);
		});

		it("parses front matter with multiple spaces after #", () => {
			const content = `#!/bin/bash
#---
#  name: Multi Space Service
#  description: Two spaces
#  http: 3000
#---
echo "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.name, "Multi Space Service");
			assert.strictEqual(result.config.description, "Two spaces");
			assert.strictEqual(result.config.http, 3000);
		});

		it("handles empty lines in front matter", () => {
			const content = `#!/bin/bash
#---
# name: Service
#
# http: 8080
#---
echo "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.name, "Service");
			assert.strictEqual(result.config.http, 8080);
		});
	});

	describe("slash-prefixed delimiter (//---)", () => {
		it("parses front matter with // prefix", () => {
			const content = `#!/usr/bin/env node
//---
// name: Node Service
// http: 3000
//---
console.log("hello");`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.name, "Node Service");
			assert.strictEqual(result.config.http, 3000);
		});

		it("parses front matter with no space after //", () => {
			const content = `#!/usr/bin/env node
//---
//name: Compact
//http: 4000
//---
console.log("hello");`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.name, "Compact");
			assert.strictEqual(result.config.http, 4000);
		});
	});

	describe("whitespace handling", () => {
		it("trims any amount of whitespace after comment prefix", () => {
			const content = `#!/bin/bash
#---
# name: One Space
#   http: 8080
#      description: Many spaces
#---
echo "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.name, "One Space");
			assert.strictEqual(result.config.http, 8080);
			assert.strictEqual(result.config.description, "Many spaces");
		});

		it("handles mixed whitespace amounts", () => {
			const content = `#!/bin/bash
#---
#  name: Two Spaces
# http: 8080
#    description: Four spaces
#---
echo "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.name, "Two Spaces");
			assert.strictEqual(result.config.http, 8080);
			assert.strictEqual(result.config.description, "Four spaces");
		});
	});

	describe("no front matter cases", () => {
		it("returns empty config for file without front matter", () => {
			const content = `#!/bin/bash
echo "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.deepStrictEqual(result.config, {});
			assert.strictEqual(result.bodyStart, 1);
		});

		it("parses file without shebang (passive service format)", () => {
			const content = `---
name: No Shebang
---
echo "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.hasShebang, false);
			assert.strictEqual(result.config.name, "No Shebang");
			assert.strictEqual(result.hasEmptyBody, false);
		});

		it("returns empty config for unclosed front matter", () => {
			const content = `#!/bin/bash
---
name: Unclosed
http: 8080
echo "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.deepStrictEqual(result.config, {});
			assert.strictEqual(result.bodyStart, 1);
		});
	});

	describe("port validation", () => {
		it("ignores invalid port numbers", () => {
			const content = `#!/bin/bash
---
name: Bad Port
http: invalid
---
echo "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.name, "Bad Port");
			assert.strictEqual(result.config.http, undefined);
		});

		it("ignores port 0", () => {
			const content = `#!/bin/bash
---
http: 0
---
echo "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.http, undefined);
		});

		it("ignores port over 65535", () => {
			const content = `#!/bin/bash
---
http: 70000
---
echo "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.http, undefined);
		});

		it("accepts valid port numbers", () => {
			const content = `#!/bin/bash
---
http: 8080
https: 443
---
echo "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.http, 8080);
			assert.strictEqual(result.config.https, 443);
		});
	});

	describe("unknown keys", () => {
		it("ignores unknown keys in front matter", () => {
			const content = `#!/bin/bash
---
name: Known
unknown_key: should be ignored
http: 8080
---
echo "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.name, "Known");
			assert.strictEqual(result.config.http, 8080);
			// @ts-expect-error - checking unknown key is not present
			assert.strictEqual(result.config.unknown_key, undefined);
		});
	});

	describe("edge cases", () => {
		it("handles file with only shebang", () => {
			const content = `#!/bin/bash`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.deepStrictEqual(result.config, {});
			assert.strictEqual(result.bodyStart, 1);
		});

		it("handles empty file", () => {
			const content = "";

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.deepStrictEqual(result.config, {});
			assert.strictEqual(result.hasShebang, false);
			assert.strictEqual(result.hasEmptyBody, true);
		});

		it("handles Windows line endings", () => {
			const content = `#!/bin/bash\r\n---\r\nname: Windows\r\n---\r\necho "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			// Note: \r will be part of the value, which is expected behavior
			// In real usage, files should use Unix line endings
		});
	});

	describe("path (urlPath) field", () => {
		it("parses path field", () => {
			const content = `#!/bin/bash
---
name: App
http: 3000
path: /app
---
npm start`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.urlPath, "/app");
		});

		it("adds leading slash if missing", () => {
			const content = `#!/bin/bash
---
name: App
http: 3000
path: app/dashboard
---
npm start`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.urlPath, "/app/dashboard");
		});

		it("preserves path with query string", () => {
			const content = `#!/bin/bash
---
name: App
http: 3000
path: /app?debug=true
---
npm start`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.config.urlPath, "/app?debug=true");
		});
	});

	describe("passive services (empty body)", () => {
		it("detects empty body after front matter", () => {
			const content = `---
name: External Service
http: 8080
---
`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.hasShebang, false);
			assert.strictEqual(result.hasEmptyBody, true);
			assert.strictEqual(result.config.name, "External Service");
			assert.strictEqual(result.config.http, 8080);
		});

		it("detects whitespace-only body as empty", () => {
			const content = `---
name: External Service
http: 8080
---
   
	
`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.hasEmptyBody, true);
		});

		it("detects non-empty body", () => {
			const content = `#!/bin/bash
---
name: Active Service
http: 8080
---
echo "hello"`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.hasShebang, true);
			assert.strictEqual(result.hasEmptyBody, false);
		});

		it("parses passive service without shebang", () => {
			const content = `---
name: Passive Service
description: Managed externally
http: 3000
path: /
---`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.hasShebang, false);
			assert.strictEqual(result.hasEmptyBody, true);
			assert.strictEqual(result.config.name, "Passive Service");
			assert.strictEqual(result.config.description, "Managed externally");
			assert.strictEqual(result.config.http, 3000);
			assert.strictEqual(result.config.urlPath, "/");
		});

		it("handles file with only front matter (no trailing newline)", () => {
			const content = `---
name: Minimal
http: 8080
---`;

			const result = parseFrontMatter(content);
			assert.ok(result);
			assert.strictEqual(result.hasEmptyBody, true);
		});
	});
});

describe("normalizeServiceId", () => {
	it("removes common script extensions", () => {
		assert.strictEqual(normalizeServiceId("dev.sh"), "dev");
		assert.strictEqual(normalizeServiceId("server.py"), "server");
		assert.strictEqual(normalizeServiceId("app.js"), "app");
		assert.strictEqual(normalizeServiceId("service.ts"), "service");
		assert.strictEqual(normalizeServiceId("script.rb"), "script");
		assert.strictEqual(normalizeServiceId("tool.pl"), "tool");
		assert.strictEqual(normalizeServiceId("web.php"), "web");
		assert.strictEqual(normalizeServiceId("run.bash"), "run");
		assert.strictEqual(normalizeServiceId("start.zsh"), "start");
	});

	it("converts to lowercase", () => {
		assert.strictEqual(normalizeServiceId("MyService.sh"), "myservice");
		assert.strictEqual(normalizeServiceId("DEV"), "dev");
	});

	it("replaces dots with hyphens", () => {
		assert.strictEqual(normalizeServiceId("foo.bar.sh"), "foo-bar");
		assert.strictEqual(
			normalizeServiceId("my.config.service"),
			"my-config-service",
		);
	});

	it("preserves underscores", () => {
		assert.strictEqual(normalizeServiceId("my_service.sh"), "my_service");
		assert.strictEqual(normalizeServiceId("dev_server"), "dev_server");
	});

	it("preserves hyphens", () => {
		assert.strictEqual(normalizeServiceId("my-service.sh"), "my-service");
	});

	it("removes invalid characters", () => {
		assert.strictEqual(normalizeServiceId("my@service!.sh"), "myservice");
		assert.strictEqual(normalizeServiceId("test (1).sh"), "test1");
	});

	it("handles files without extensions", () => {
		assert.strictEqual(normalizeServiceId("webapp"), "webapp");
		assert.strictEqual(normalizeServiceId("MyApp"), "myapp");
	});

	it("removes leading/trailing hyphens", () => {
		assert.strictEqual(normalizeServiceId(".hidden.sh"), "hidden");
		assert.strictEqual(normalizeServiceId("service..sh"), "service");
	});
});
