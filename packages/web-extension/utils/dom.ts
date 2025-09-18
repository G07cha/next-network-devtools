import { type RefObject, useEffect } from "react";

interface UseFocusTrapOptions {
	disabled?: boolean;
}

export const useFocusTrap = (
	ref: RefObject<HTMLElement | null>,
	options: UseFocusTrapOptions,
) => {
	// biome-ignore lint/correctness/useExhaustiveDependencies: ref.current is not needed as dependency as refs are mutable objects
	useEffect(() => {
		if (options.disabled || !ref.current) return;

		const panel = ref.current;
		const focusableElements = panel.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
		);
		const firstElement = focusableElements[0] as HTMLElement;
		const lastElement = focusableElements[
			focusableElements.length - 1
		] as HTMLElement;

		const handleTabKey = (event: KeyboardEvent) => {
			if (event.key !== "Tab") return;

			if (event.shiftKey) {
				if (document.activeElement === firstElement) {
					event.preventDefault();
					lastElement?.focus();
				}
			} else {
				if (document.activeElement === lastElement) {
					event.preventDefault();
					firstElement?.focus();
				}
			}
		};

		panel.addEventListener("keydown", handleTabKey);
		return () => panel.removeEventListener("keydown", handleTabKey);
	}, [options]);
};
