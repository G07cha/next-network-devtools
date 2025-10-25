import { cn } from "~/utils/style";

export interface CardProps {
	children: React.ReactNode;
	className?: string;
}

export const Card = ({ children, className, ...props }: CardProps) => {
	return (
		<div
			{...props}
			className={cn("p-4 rounded-lg border border-border-primary", className)}
		>
			{children}
		</div>
	);
};
