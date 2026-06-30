import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stream.WitUS",
  description:
    "A personal-first cross-media tracker and companion for the All The Spoilers podcast — books, movies, TV — plus the ReadWitUS book club.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
