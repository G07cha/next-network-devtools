"use server";

import type { User } from "./types";

const BASE_URL = "http://127.0.0.1:3000";

export async function getUsersAction(): Promise<User[]> {
	try {
		const response = await fetch(`${BASE_URL}/api/users`, {
			cache: "no-store", // Always get fresh data
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch users: ${response.statusText}`);
		}

		return await response.json();
	} catch (error) {
		console.error("Error in getUsersAction:", error);
		throw error;
	}
}

export async function getUserAction(id: string): Promise<User | null> {
	try {
		const response = await fetch(`${BASE_URL}/api/user/${id}`, {
			cache: "no-store", // Always get fresh data
		});

		if (!response.ok) {
			if (response.status === 404) {
				return null;
			}
			throw new Error(`Failed to fetch user: ${response.statusText}`);
		}

		return await response.json();
	} catch (error) {
		console.error("Error in getUserAction:", error);
		throw error;
	}
}
