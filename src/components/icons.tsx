import type { SVGProps } from "react";
import Image from "next/image";

export const Icons = {
  whatsapp: (props: SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M16.6 14.2c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.5-1.5-1.8-.1-.2 0-.4.1-.5.1-.1.2-.2.4-.4.1-.1.2-.2.2-.3.1-.1.1-.2 0-.4-.1-.1-.6-1.5-.8-2-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2 1 2.4c.1.1 1.5 2.3 3.6 3.2.5.2.8.3 1.1.4.5.1.9.1 1.2.1.4-.1.8-.4 1.1-.7.3-.4.3-.7.2-.8l-.1-.1zM12 2a10 10 0 1 0 10 10 10 10 0 0 0-10-10zM12 20.2c-4.5 0-8.2-3.7-8.2-8.2S7.5 3.8 12 3.8s8.2 3.7 8.2 8.2-3.7 8.2-8.2 8.2z"/>
    </svg>
  ),
  discord: (props: { className?: string }) => (
    <Image src="https://i.imgur.com/AcP9SrS.png" alt="Discord Icon" width={891} height={633} {...props} />
  ),
};
