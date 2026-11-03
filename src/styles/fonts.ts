import { Geist, Geist_Mono } from "next/font/google";

// Self-hosted at build time. The variable names are the ones theme.css reads in
// `--typeface-*`: change the typefaces there and here together.
export const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  // Not used above the fold: it loads when a page needs it, with no preload.
  preload: false,
});
