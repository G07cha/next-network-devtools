import { BatchInterceptor } from "@mswjs/interceptors";
import { ClientRequestInterceptor } from "@mswjs/interceptors/ClientRequest";
import { FetchInterceptor } from "@mswjs/interceptors/fetch";
import { XMLHttpRequestInterceptor } from "@mswjs/interceptors/XMLHttpRequest";

export const createInterceptor = () => {
	const interceptors = [
		new ClientRequestInterceptor(),
		new XMLHttpRequestInterceptor(),
		new FetchInterceptor(),
	] as const;

	const interceptor = new BatchInterceptor({
		name: "my-interceptor",
		interceptors: interceptors,
	});

	interceptor.apply();

	return interceptor;
};
