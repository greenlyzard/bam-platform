import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Class Schedule — Ballet Academy and Movement",
  robots: { index: false, follow: false },
};

export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#FAF9F7", color: "#2C2C2C" }}>
      {children}
    </div>
  );
}
