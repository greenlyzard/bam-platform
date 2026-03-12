import { CartProvider } from "@/lib/cart-context";
import { CartIndicator } from "@/components/bam/cart-indicator";

export default function EnrollLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      {children}
      <CartIndicator />
    </CartProvider>
  );
}
