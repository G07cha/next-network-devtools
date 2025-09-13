import { NextResponse } from "next/server";
import type { User } from "../../../lib/types";

// Fake users data
const users: User[] = [{ id: 1 }, { id: 2 }, { id: 3 }];

export async function GET() {
	try {
		// Preserve the exact same behavior as the original API route
		// Make test requests to localhost:4000 for network tracking
		fetch(
			"http://localhost:4000/api/mock?status=200&delay=100&body=" +
				JSON.stringify(users),
		);
		fetch(
			"http://localhost:4000/api/mock?status=200&delay=2000&body=" +
				JSON.stringify(users),
		);

		const response = await fetch(
			"http://localhost:4000/api/mock?status=200&delay=1000&body=" +
				JSON.stringify(users),
		);

		await response.json();

		return NextResponse.json(users);
	} catch (error) {
		console.error("Error fetching users:", error);
		return NextResponse.json(
			{ error: "Failed to fetch users" },
			{ status: 500 },
		);
	}
}
