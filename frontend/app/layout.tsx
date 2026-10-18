import "./globals.css";
import { Iceberg } from "next/font/google";

const iceberg = Iceberg({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-iceberg",
});

export const metadata = {
  title: "SkyQuant",
  description: "Quantitative Aviation Economics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={iceberg.variable}>
      <body className="antialiased selection:bg-cyan-500/30 bg-[#000000] text-gray-300">
        {children}
      </body>
    </html>
  );
}