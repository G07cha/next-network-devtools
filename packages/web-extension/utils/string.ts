export const truncate = (value: string, maxLength: number) => {
	if (value.length <= maxLength) return value;
	const start = value.substring(0, maxLength / 2 - 3);
	const end = value.substring(value.length - maxLength / 2 + 3);
	return `${start}...${end}`;
};
