import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tasty Corner — Menu",
  description: "Local flavours, familiar favourites. Freshly made, always worth it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
