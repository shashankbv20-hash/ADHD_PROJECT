import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DemoAuthProvider } from "@/features/auth/demo-auth-provider";
import { FirebaseAuthProvider } from "@/features/auth/firebase-auth-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Attune — ADHD EEG research workspace",
    template: "%s · Attune",
  },
  description:
    "Attune is a research prototype for exploring EEG sessions, cognitive activities, and digital twin profiles in ADHD research. Not a diagnostic or treatment device.",
  applicationName: "Attune",
  category: "research",
};

export const viewport: Viewport = {
  themeColor: "#0b1c2c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full">
        <DemoAuthProvider>
          <FirebaseAuthProvider>{children}</FirebaseAuthProvider>
        </DemoAuthProvider>
      </body>
    </html>
  );
}
