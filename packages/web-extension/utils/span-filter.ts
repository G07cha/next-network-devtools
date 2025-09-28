import { storage } from "@wxt-dev/storage";
import { useCallback, useEffect, useState } from "react";

export enum SpanFilter {
	ALL = "All",
	ROOT_SPANS = "Condensed",
	REQUESTS_ONLY = "Requests",
}

export const spanFilterStorage = storage.defineItem<SpanFilter>(
	"sync:spanFilter",
	{
		fallback: SpanFilter.ROOT_SPANS,
	},
);

export const useSpanFilter = () => {
	const [spanFilter, setSpanFilterValue] = useState<SpanFilter>(
		spanFilterStorage.fallback,
	);

	const setSpanFilter = useCallback((value: SpanFilter) => {
		spanFilterStorage.setValue(value);
	}, []);

	useEffect(() => {
		spanFilterStorage.getValue().then(setSpanFilterValue);
		return spanFilterStorage.watch(setSpanFilterValue);
	}, []);

	return [spanFilter, setSpanFilter] as const;
};
