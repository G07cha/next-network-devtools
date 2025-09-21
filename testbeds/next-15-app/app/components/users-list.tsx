"use client";

import Link from "next/link";
import useSwr from "swr";
import type { User } from "../../lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface UsersListProps {
	initialData?: User[];
}

export default function UsersList({ initialData }: UsersListProps) {
	const { data, error, isLoading } = useSwr<User[]>("/api/users", fetcher, {
		fallbackData: initialData,
	});

	if (error) return <div>Failed to load users</div>;
	if (isLoading && !data) return <div>Loading...</div>;
	if (!data) return null;

	return (
		<ul>
			{data.map((user) => (
				<li key={user.id}>
					<Link href={`/user/${user.id}`}>
						{user.name ?? `User ${user.id}`}
					</Link>
				</li>
			))}
		</ul>
	);
}
