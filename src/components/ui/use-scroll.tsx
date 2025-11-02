'use client';
import React from 'react';

export function useScroll(threshold: number) {
	const [scrolled, setScrolled] = React.useState(false);

	React.useEffect(() => {
		const onScroll = () => {
			setScrolled(window.scrollY > threshold);
		};

        // Check scroll position on mount (client-side only)
        onScroll();

		window.addEventListener('scroll', onScroll);
		return () => window.removeEventListener('scroll', onScroll);
	}, [threshold]);

	return scrolled;
}
