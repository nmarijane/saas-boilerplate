// A price that rolls into place when the period changes: the figure is keyed by
// its text, so a new one is a new element and plays the entrance (`animate-price-roll`,
// which reduced motion switches off). The old one is gone at once: only the new
// price is in the page, for assistive technology too.
export function RollingPrice({ value, className }: { value: string; className?: string }) {
  return (
    <span key={value} className={`inline-block animate-price-roll ${className ?? ""}`}>
      {value}
    </span>
  );
}
