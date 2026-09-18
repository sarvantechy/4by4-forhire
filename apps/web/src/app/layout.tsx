import type { Metadata } from "next";
import "@4by4/design-tokens/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "4by4 For Hire",
    template: "%s | 4by4 For Hire",
  },
  description: "Find and rent practical items from people near you.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
