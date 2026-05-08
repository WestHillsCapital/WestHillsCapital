import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Gone() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#C49A38] mb-3">410 Gone</p>
      <h1 className="text-5xl font-serif font-bold text-foreground mb-4">
        This page no longer exists
      </h1>
      <p className="text-lg text-foreground/60 mb-8 max-w-md">
        This content has been permanently removed and will not return. If you're
        looking for information on precious metals IRAs, we'd love to help.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/">
          <Button size="lg">Return Home</Button>
        </Link>
        <Link href="/schedule">
          <Button size="lg" variant="outline">Schedule a Call</Button>
        </Link>
      </div>
    </div>
  );
}
