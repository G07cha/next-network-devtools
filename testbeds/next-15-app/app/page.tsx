import { getUsersAction } from "../lib/actions";
import type { User } from "../lib/types";
import UsersList from "./components/users-list";

export default async function HomePage() {
	let initialUsers: User[];

	try {
		// Fetch initial data on the server for SSR
		initialUsers = await getUsersAction();
	} catch (error) {
		console.error("Failed to fetch initial users:", error);
		// Fallback to empty array, client component will handle the error
		initialUsers = [];
	}

	return (
		<div>
			<h1>Users</h1>
			<UsersList initialData={initialUsers} />
		</div>
	);
}
