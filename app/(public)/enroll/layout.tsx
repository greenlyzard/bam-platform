import { CartProvider } from "@/lib/cart-context";
import { CartIndicator } from "@/components/bam/cart-indicator";
import EnrollmentAssistant from "@/components/enrollment/enrollment-assistant";

export default function EnrollLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      {children}
      <CartIndicator />
      <EnrollmentAssistant />
    </CartProvider>
  );
}
