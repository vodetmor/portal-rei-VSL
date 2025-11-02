'use client';
import { useState, useEffect } from 'react';

export function useScroll(threshold: number) {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => {
			setScrolled(window.scrollY > threshold);
		};
        
        // Check scroll position on mount (client-side only) and add listener
        onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		
        // Cleanup listener on unmount
		return () => window.removeEventListener('scroll', onScroll);
	}, [threshold]);

	return scrolled;
}
