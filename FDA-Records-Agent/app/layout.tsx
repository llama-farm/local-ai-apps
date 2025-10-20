import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FDA Document Processing - Local Regulatory Analysis",
  description: "Extract questions from FDA correspondence and validate answers locally using AI",
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
              // Suppress MetaMask and other browser extension errors
              (function() {
                const shouldSuppress = (args) => {
                  const message = args.join(' ');
                  return (
                    message.includes('MetaMask') ||
                    message.includes('chrome-extension://') ||
                    message.includes('moz-extension://') ||
                    message.includes('dcvalue') ||
                    message.includes('Failed to connect to MetaMask') ||
                    message.includes('__nextjs_original-stack-frame')
                  );
                };

                const originalError = console.error;
                const originalWarn = console.warn;

                console.error = function(...args) {
                  if (!shouldSuppress(args)) {
                    originalError.apply(console, args);
                  }
                };

                console.warn = function(...args) {
                  if (!shouldSuppress(args)) {
                    originalWarn.apply(console, args);
                  }
                };
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
