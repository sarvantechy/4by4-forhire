import { AuthPanel } from "@/components/AuthPanel";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Register" };

export default function RegisterPage() {
  return <main id="main-content"><AuthPanel initialMode="register" /></main>;
}