import debounce from "debounce";
import { defineContentScript } from "wxt/utils/define-content-script";
import { ExtensionMessageType, sendMessage } from "~/utils/messaging";
import { detectNextjs } from "~/utils/nextjs-detector";

export default defineContentScript({
	matches: ["*://localhost/*", "*://127.0.0.1/*"],
	main() {
		// Perform initial detection when page loads
		// Wait a bit for the DOM to be fully ready
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", () => {
				setTimeout(performDetection, 100);
			});
		} else {
			// DOM is already ready
			setTimeout(performDetection, 100);
		}

		// Set up mutation observer to detect dynamic changes
		const observer = new MutationObserver((mutations) => {
			// Check if any mutations added script tags or significant DOM changes
			const hasSignificantChanges = mutations.some((mutation) => {
				if (mutation.type === "childList") {
					return Array.from(mutation.addedNodes).some((node) => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							const element = node as Element;
							return (
								element.tagName === "SCRIPT" ||
								element.querySelector?.("script")
							);
						}
						return false;
					});
				}
				return false;
			});

			if (hasSignificantChanges) {
				// Debounce detection to avoid excessive calls
				debouncedDetection();
			}
		});

		observer.observe(document, {
			childList: true,
			subtree: true,
		});

		// Listen for navigation changes (SPA routing)
		let lastUrl = location.href;
		new MutationObserver(() => {
			const currentUrl = location.href;
			if (currentUrl !== lastUrl) {
				lastUrl = currentUrl;
				// URL changed, re-run detection after a brief delay to allow content to load
				setTimeout(performDetection, 500);
			}
		}).observe(document, { subtree: true, childList: true });
	},
});

const debouncedDetection = debounce(performDetection, 1000);

async function performDetection() {
	try {
		const result = detectNextjs();

		// Send result to background script - the background will determine the tab ID
		try {
			await sendMessage({
				type: ExtensionMessageType.DETECTION,
				tabId: 0, // Will be set by background script based on sender
				result,
			});
		} catch (error) {
			console.error("NextNetwork: Failed to send detection message", error);
		}
	} catch {
		// Ignore the error
	}
}
