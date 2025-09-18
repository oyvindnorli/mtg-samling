import React from "react";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
};
export default function Button({ className = "", variant = "primary", ...rest }: Props) {
  const base =
    "px-3 py-2 rounded-2xl text-sm font-medium shadow-sm transition hover:shadow focus:outline-none focus:ring";
  const variants: Record<string, string> = {
    primary: "bg-black text-white",
    ghost: "bg-transparent text-black hover:bg-gray-100",
    outline: "bg-white border border-gray-300 hover:bg-gray-50",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}
