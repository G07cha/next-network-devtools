"use client";

import useSwr from "swr";
import type { User } from "../../lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface UserDetailProps {
	userId: string;
	initialData?: User | null;
}

export default function UserDetail({ userId, initialData }: UserDetailProps) {
	const { data, error, isLoading } = useSwr<User>(
		`/api/user/${userId}`,
		fetcher,
		{
			fallbackData: initialData,
			refreshInterval: 5000, // Refresh every 5 seconds for real-time updates
		},
	);

	if (error) return <div>Failed to load user</div>;
	if (isLoading && !data) return <div>Loading...</div>;
	if (!data) return <div>User not found</div>;

	return (
		<div>
			<h1>User Details</h1>
			<p>ID: {data.id}</p>
			<p>Name: {data.name ?? `User ${data.id}`}</p>
		</div>
	);
}
