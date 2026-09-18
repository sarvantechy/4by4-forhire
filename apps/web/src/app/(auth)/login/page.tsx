import { AuthPanel } from "@/components/AuthPanel";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <main id="main-content"><AuthPanel initialMode="login" /></main>;
}
