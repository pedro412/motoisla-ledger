import type { Metadata } from "next";
import { Space_Grotesk, Source_Sans_3 } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppChrome } from "@/app/app-chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "MotoIsla Ledger",
  description: "Control financiero por inversionista con PostgreSQL",
};

const headingFont = Space_Grotesk({ subsets: ["latin"], variable: "--font-heading" });
const bodyFont = Source_Sans_3({ subsets: ["latin"], variable: "--font-body" });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="es" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body className="min-h-screen bg-background text-foreground">
        <AppChrome session={session}>{children}</AppChrome>
      </body>
    </html>
  );
}
