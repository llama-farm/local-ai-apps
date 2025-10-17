import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Health Copilot - Local Medical Assistant",
  description: "Privacy-first medical record assistant powered by local AI",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Suppress MetaMask and other browser extension errors in development
              if (typeof window !== 'undefined') {
                const originalError = console.error;
                console.error = (...args) => {
                  const errorString = args.join(' ');
                  // Suppress known extension errors
                  if (
                    errorString.includes('MetaMask') ||
                    errorString.includes('chrome-extension://') ||
                    errorString.includes('moz-extension://') ||
                    errorString.includes('dcvalue')
                  ) {
                    return;
                  }
                  originalError.apply(console, args);
                };
              }
            `,
          }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
