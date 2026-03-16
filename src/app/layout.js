import "./globals.css";

export const metadata = {
  title: "Ads Campaign Tracker",
  description: "Reconcile Google Ads campaigns against your master sheet",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
