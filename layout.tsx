import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Original Tube — Watch. Create. Share.",
  description: "Discover videos and share your story on Original Tube.",
  applicationName: "Original Tube",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Original Tube" },
};
export const viewport: Viewport = { themeColor: "#101010", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}