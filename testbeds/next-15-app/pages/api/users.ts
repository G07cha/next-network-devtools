import type { NextApiRequest, NextApiResponse } from "next";
import type { User } from "../../interfaces";

// Fake users data
const users: User[] = [{ id: 1 }, { id: 2 }, { id: 3 }];

export default function handler(
	_req: NextApiRequest,
	res: NextApiResponse<User[]>,
) {
	fetch(
		"http://localhost:4000/api/mock?status=200&delay=1000&body=" +
			JSON.stringify(users),
	)
		.then((response) => response.json())
		.then(() => {
			res.status(200).json(users);
		})
		.catch((error) => {
			console.error("Error fetching users:", error);
			res.status(500).json({ error: "Failed to fetch users" });
		});
}
