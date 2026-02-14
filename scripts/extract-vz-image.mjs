#!/usr/bin/env node
/**
 * Extract VZ image files from Docker registry for Tauri bundling
 *
 * This script uses `crane` (from go-containerregistry) to pull a VZ Docker
 * image from the registry and extract the kernel and rootfs files to
 * src-tauri/resources/ for bundling into the macOS app.
 *
 * Prerequisites: crane must be installed (go install github.com/google/go-containerregistry/cmd/crane@latest)
 *
 * Usage: node scripts/extract-vz-image.mjs [image-ref] [arch]
 *   image-ref: Docker image reference (defaults to ghcr.io/obot-platform/discobot-vz:main)
 *   arch: Architecture (amd64 or arm64, defaults to host arch)
 */

import { execSync } from "node:child_process";
import { mkdirSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const resourcesDir = join(projectRoot, "src-tauri", "resources");

// Parse arguments
const imageRef = process.argv[2] || "ghcr.io/obot-platform/discobot-vz:main";
const arch = process.argv[3] || (process.arch === "arm64" ? "arm64" : "amd64");

// Ensure resources directory exists
mkdirSync(resourcesDir, { recursive: true });

console.log(`Extracting VZ image files for ${arch}...`);
console.log(`Image: ${imageRef}`);
console.log(`Output directory: ${resourcesDir}`);

const extractFiles = ["vmlinuz", "kernel-version", "discobot-rootfs.squashfs"];
const outputFiles =
	arch === "arm64"
		? ["vmlinux", "kernel-version", "discobot-rootfs.squashfs"]
		: extractFiles;

try {
	// Use crane to export the image filesystem as a tar and extract the files
	// crane doesn't require a Docker daemon, making it suitable for macOS CI
	console.log(`Exporting image with crane (platform linux/${arch})...`);
	execSync(
		`crane export --platform "linux/${arch}" "${imageRef}" - | tar xf - -C "${resourcesDir}" ${extractFiles.join(" ")}`,
		{ stdio: "inherit" },
	);

	// On arm64, decompress vmlinuz (gzip) to vmlinux for Virtualization.framework
	if (arch === "arm64") {
		const vmlinuzPath = join(resourcesDir, "vmlinuz");
		const vmlinuxPath = join(resourcesDir, "vmlinux");
		console.log("Decompressing vmlinuz → vmlinux for arm64...");
		execSync(`gunzip -c "${vmlinuzPath}" > "${vmlinuxPath}"`, {
			stdio: "inherit",
		});
		unlinkSync(vmlinuzPath);
	}

	console.log("VZ image files extracted successfully:");
	for (const file of outputFiles) {
		const filePath = join(resourcesDir, file);
		try {
			const stats = statSync(filePath);
			const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
			console.log(`  ${file}: ${sizeMB} MB`);
		} catch {
			console.log(`  ${file} (size unknown)`);
		}
	}
} catch (error) {
	console.error("Failed to extract VZ image:", error.message);
	process.exit(1);
}
