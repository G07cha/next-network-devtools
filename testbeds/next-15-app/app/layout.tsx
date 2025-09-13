import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Next.js API Routes REST App",
	description:
		"A Next.js application demonstrating API routes with REST patterns",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body>
				<main>{children}</main>
			</body>
		</html>
	);
}
