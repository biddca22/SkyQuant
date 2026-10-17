import "./globals.css";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif-display",
});

export const metadata = {
  title: "SkyQuant",
  description: "Quantitative Aviation Economics & Trajectory Intelligence",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={playfair.variable}>
      <body className="antialiased selection:bg-fuchsia-500/30 bg-[#000000] text-gray-300">
        {children}
      </body>
    </html>
  );
}