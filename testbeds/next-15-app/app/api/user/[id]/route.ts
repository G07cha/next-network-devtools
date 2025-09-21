import { NextResponse } from "next/server";
import type { User } from "../../../../lib/types";

// Fake users data
const users: User[] = [
	{ id: 1, name: "John Doe" },
	{ id: 2, name: "Jane Smith" },
	{ id: 3, name: "Bob Johnson" },
];

export async function GET(_: Request, { params }: { params: { id: string } }) {
	try {
		const userId = parseInt(params.id);

		if (Number.isNaN(userId)) {
			return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
		}

		const user = users.find((u) => u.id === userId);

		if (!user) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		// Make a test request for network tracking (similar to users endpoint)
		fetch(
			`http://localhost:4000/api/mock?status=200&delay=500&body=${JSON.stringify(user)}`,
		);

		return NextResponse.json(user);
	} catch (error) {
		console.error("Error fetching user:", error);
		return NextResponse.json(
			{ error: "Failed to fetch user" },
			{ status: 500 },
		);
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: { id: string } },
) {
	try {
		const userId = parseInt(params.id);

		if (Number.isNaN(userId)) {
			return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
		}

		const body = await request.json();
		const userIndex = users.findIndex((u) => u.id === userId);

		if (userIndex === -1) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		// Update user data
		users[userIndex] = { ...users[userIndex], ...body };

		// Make a test request for network tracking
		fetch(
			`http://localhost:4000/api/mock?status=200&delay=300&body=${JSON.stringify(users[userIndex])}`,
		);

		return NextResponse.json(users[userIndex]);
	} catch (error) {
		console.error("Error updating user:", error);
		return NextResponse.json(
			{ error: "Failed to update user" },
			{ status: 500 },
		);
	}
}
