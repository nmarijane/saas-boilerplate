import { notFound } from "next/navigation";

// Every address of the language that no other page answers ends here, and
// `notFound()` is what draws the not-found of the language (../not-found.tsx)
// and makes the response a 404: a page that drew the same thing itself would
// answer 200.
export default function UnknownPage() {
  notFound();
}
