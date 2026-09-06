import type { Metadata } from "next";
import "./premium.css";

export const metadata: Metadata = {
  title: "Owner Sign In",
  robots: { index: false, follow: false },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
