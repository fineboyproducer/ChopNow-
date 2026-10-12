import { redirect } from "next/navigation";

/**
 * The bare root path isn't a page of its own — it exists so unauthenticated
 * visitors and search engines have a stable public URL, but the actual
 * homepage experience lives at /home (inside the (customer) route group,
 * behind the customer navbar/cart provider). Redirect here immediately.
 */
export default function RootPage() {
  redirect("/home");
}
