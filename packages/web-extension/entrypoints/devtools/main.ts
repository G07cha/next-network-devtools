import { browser } from "wxt/browser";
import {
	ExtensionMessageType,
	isDevToolsResponseMessage,
	sendMessage,
} from "../../utils/messaging";

let panelCreated = false;

async function waitForDetection(maxAttempts = 10): Promise<boolean> {
	const tabId = browser.devtools.inspectedWindow.tabId;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		console.log(
			`NextNetwork: Detection attempt ${attempt}/${maxAttempts} for tab ${tabId}`,
		);

		try {
			const response = await sendMessage({
				type: ExtensionMessageType.QUERY_STATUS,
				tabId,
			});

			console.log(`NextNetwork: Attempt ${attempt} response:`, response);

			if (
				response &&
				isDevToolsResponseMessage(response) &&
				response.result?.isNextjs &&
				response.result?.isDevelopment
			) {
				console.log("NextNetwork: Next.js development detected!");
				return true;
			}

			// Wait progressively longer between attempts
			const delay = Math.min(1000 * attempt, 5000);
			await new Promise((resolve) => setTimeout(resolve, delay));
		} catch (error) {
			console.error(`NextNetwork: Detection attempt ${attempt} failed:`, error);
		}
	}

	console.log(
		"NextNetwork: No Next.js development detected after all attempts",
	);
	return false;
}

async function createPanelWhenReady() {
	if (panelCreated) return;

	console.log("NextNetwork: Waiting for Next.js detection...");

	const detected = await waitForDetection();

	if (detected && !panelCreated) {
		console.log(
			"NextNetwork: Creating DevTools panel - Next.js development confirmed",
		);

		try {
			browser.devtools.panels.create(
				"NextNetwork",
				"icon/128.png",
				"devtools-panel.html",
			);

			panelCreated = true;
			console.log("NextNetwork: DevTools panel created successfully");
		} catch (error) {
			console.error("NextNetwork: Failed to create panel:", error);
		}
	} else {
		console.log(
			"NextNetwork: Not creating panel - Next.js development not detected",
		);
	}
}

// Listen for detection updates from background script
browser.runtime.onMessage.addListener((message) => {
	if (
		message.type === "NEXTJS_DETECTION" &&
		message.tabId === browser.devtools.inspectedWindow.tabId
	) {
		console.log("NextNetwork: Received detection update:", message.result);

		if (
			message.result.isNextjs &&
			message.result.isDevelopment &&
			!panelCreated
		) {
			console.log("NextNetwork: Creating panel due to detection update");
			createPanelWhenReady();
		}
	}
});

// Initialize when DevTools opens
createPanelWhenReady();
