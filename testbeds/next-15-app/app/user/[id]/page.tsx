import Link from "next/link";
import { getUserAction } from "../../../lib/actions";
import type { User } from "../../../lib/types";
import UserDetail from "../../components/user-detail";

interface UserPageProps {
	params: { id: string };
}

export default async function UserPage({ params }: UserPageProps) {
	let initialUser: User | null;

	try {
		// Fetch initial data on the server for SSR
		initialUser = await getUserAction(params.id);
	} catch (error) {
		console.error("Failed to fetch initial user:", error);
		// Fallback to null, client component will handle the error
		initialUser = null;
	}

	return (
		<div>
			<Link href="/">← Back to Users</Link>
			<UserDetail userId={params.id} initialData={initialUser} />
		</div>
	);
}
