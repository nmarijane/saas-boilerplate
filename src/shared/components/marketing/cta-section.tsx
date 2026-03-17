import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Link } from "@/shared/lib/i18n-navigation";

interface CtaSectionProps {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}

export function CtaSection({
  title,
  description,
  ctaLabel,
  ctaHref,
}: CtaSectionProps) {
  return (
    <section className="py-20 sm:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl rounded-2xl bg-primary/5 px-6 py-16 text-center sm:px-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            {description}
          </p>
          <div className="mt-8">
            <Button size="lg" asChild>
              <Link href={ctaHref}>
                {ctaLabel}
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
