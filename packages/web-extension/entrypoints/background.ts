import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import {
	type ExtensionMessage,
	ExtensionMessageType,
	isDetectionMessage,
	isDevToolsQueryMessage,
	sendMessageToTab,
} from "../utils/messaging";
import type { NextjsDetectionResult } from "../utils/nextjs-detector";

interface TabState {
	detectionResult: NextjsDetectionResult | null;
	lastDetection: number;
}

export default defineBackground(() => {
	console.log("NextNetwork: Background script loaded", {
		id: browser.runtime.id,
	});

	// Store per-tab Next.js detection state
	const tabStates = new Map<number, TabState>();

	// Listen for messages from content scripts and devtools
	browser.runtime.onMessage.addListener(
		async (message: ExtensionMessage, sender, sendResponse) => {
			console.log("NextNetwork: Background received message", message);

			if (isDetectionMessage(message)) {
				// Get the actual tab ID from the sender (content script)
				const tabId = sender.tab?.id || message.tabId;
				if (tabId) {
					// Update tab state with detection result
					tabStates.set(tabId, {
						detectionResult: message.result,
						lastDetection: Date.now(),
					});

					console.log(
						`NextNetwork: Updated state for tab ${tabId}`,
						message.result,
					);

					// Forward detection message to any listening DevTools contexts
					// DevTools contexts listening for runtime messages will receive this
					try {
						// Broadcast the detection result - DevTools main.ts will listen for this
						browser.runtime.sendMessage({
							type: ExtensionMessageType.DETECTION,
							tabId,
							result: message.result,
						});
					} catch {
						console.log("NextNetwork: No DevTools contexts to notify");
					}
				}
				return;
			}

			if (isDevToolsQueryMessage(message)) {
				// DevTools is asking for current tab status
				const tabState = tabStates.get(message.tabId);
				const result = tabState?.detectionResult || null;

				console.log(
					`NextNetwork: DevTools query for tab ${message.tabId}`,
					result,
				);

				sendResponse({
					type: "NEXTJS_STATUS_RESPONSE",
					tabId: message.tabId,
					result,
				});
			}
		},
	);

	// Clean up old tab states when tabs are closed
	browser.tabs.onRemoved.addListener((tabId) => {
		console.log(`NextNetwork: Cleaning up state for closed tab ${tabId}`);
		tabStates.delete(tabId);
	});

	// Handle tab updates (navigation, reload)
	browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
		if (changeInfo.status === "loading" && changeInfo.url) {
			// Clear previous detection when navigating to new URL
			console.log(`NextNetwork: Tab ${tabId} navigating to ${changeInfo.url}`);
			tabStates.delete(tabId);
		}

		if (changeInfo.status === "complete") {
			// Trigger detection on the content script after page load completes
			try {
				await sendMessageToTab(tabId, {
					type: ExtensionMessageType.TAB_STATUS_UPDATE,
					tabId,
					status: "complete",
				});
			} catch {
				// Content script may not be ready yet, that's okay
			}
		}
	});
});
