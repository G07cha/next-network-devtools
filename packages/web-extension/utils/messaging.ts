import { browser } from "wxt/browser";
import type { NextjsDetectionResult } from "./nextjs-detector";

export enum ExtensionMessageType {
	DETECTION = "NEXTJS_DETECTION",
	QUERY_STATUS = "QUERY_NEXTJS_STATUS",
	STATUS_RESPONSE = "NEXTJS_STATUS_RESPONSE",
	TAB_STATUS_UPDATE = "TAB_STATUS_UPDATE",
}

export interface DetectionMessage {
	type: ExtensionMessageType.DETECTION;
	tabId: number;
	result: NextjsDetectionResult;
}

export interface DevToolsQueryMessage {
	type: ExtensionMessageType.QUERY_STATUS;
	tabId: number;
}

export interface DevToolsResponseMessage {
	type: ExtensionMessageType.STATUS_RESPONSE;
	tabId: number;
	result: NextjsDetectionResult | null;
}

export interface TabStatusMessage {
	type: ExtensionMessageType.TAB_STATUS_UPDATE;
	tabId: number;
	status: "loading" | "complete";
}

export type ExtensionMessage =
	| DetectionMessage
	| DevToolsQueryMessage
	| DevToolsResponseMessage
	| TabStatusMessage;

// Helper functions for message passing
export function sendMessage<T extends ExtensionMessage>(
	message: T,
): Promise<ExtensionMessage | undefined> {
	return browser.runtime.sendMessage(message);
}

export function sendMessageToTab<T extends ExtensionMessage>(
	tabId: number,
	message: T,
): Promise<ExtensionMessage | undefined> {
	return browser.tabs.sendMessage(tabId, message);
}

// Type guards for message validation
export function isDetectionMessage(
	message: ExtensionMessage,
): message is DetectionMessage {
	return (
		message?.type === ExtensionMessageType.DETECTION &&
		typeof message.tabId === "number"
	);
}

export function isDevToolsQueryMessage(
	message: ExtensionMessage,
): message is DevToolsQueryMessage {
	return (
		message?.type === ExtensionMessageType.QUERY_STATUS &&
		typeof message.tabId === "number"
	);
}

export function isDevToolsResponseMessage(
	message: ExtensionMessage,
): message is DevToolsResponseMessage {
	return (
		message?.type === ExtensionMessageType.STATUS_RESPONSE &&
		typeof message.tabId === "number"
	);
}

export function isTabStatusMessage(
	message: ExtensionMessage,
): message is TabStatusMessage {
	return (
		message?.type === ExtensionMessageType.TAB_STATUS_UPDATE &&
		typeof message.tabId === "number"
	);
}
