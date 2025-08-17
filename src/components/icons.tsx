import type { SVGProps } from "react";
import Image from "next/image";

export const Icons = {
  whatsapp: (props: { className?: string }) => (
    <Image src="https://i.imgur.com/YxNIgA5.png" alt="WhatsApp Icon" width={512} height={512} {...props} />
  ),
  discord: (props: { className?: string }) => (
     <Image src="https://i.imgur.com/AcP9SrS.png" alt="Discord Icon" width={891} height={633} {...props} />
  ),
};
