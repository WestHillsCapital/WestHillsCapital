import { usePageMeta } from "@/hooks/use-page-meta";

export default function Buy() {
  usePageMeta({
    title: "Buy Precious Metals | West Hills Capital",
    description: "Lock in your purchase online. Select your metals, review live pricing, sign your purchase agreement, and receive your invoice — no call required.",
    canonical: "https://westhillscapital.com/buy",
  });

  return (
    <div className="w-full min-h-[calc(100vh-200px)] bg-background pt-12 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h1 className="text-4xl font-serif font-semibold mb-4">Buy Without a Call</h1>
        <p className="text-foreground/65 text-lg">
          Self-serve purchase flow — coming soon.
        </p>
      </div>
    </div>
  );
}
