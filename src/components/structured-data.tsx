const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://n8nexperts.io").replace(/\/$/, "");

/**
 * Search engines read the marketplace through these, not through the markup:
 * a job without `JobPosting` never reaches Google Jobs, and an expert without
 * `Person` is just another page.
 */
export function StructuredData({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // The payload is built from our own records, never from user markup.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\u003c") }}
    />
  );
}

export function expertSchema(expert: {
  name: string;
  slug: string;
  title: string;
  bio: string;
  photoUrl?: string;
  location?: string;
  country?: string;
  skills?: string[];
  rating?: number;
  reviewCount?: number;
}) {
  const person: Record<string, unknown> = {
    "@type": "Person",
    name: expert.name,
    jobTitle: expert.title,
    description: expert.bio,
    url: `${appUrl}/experts/${expert.slug}`,
    knowsAbout: expert.skills?.length ? expert.skills : undefined,
    image: expert.photoUrl || undefined,
    address: expert.country
      ? { "@type": "PostalAddress", addressLocality: expert.location || undefined, addressCountry: expert.country }
      : undefined,
  };

  // A rating block with no ratings behind it is a structured-data violation.
  if (expert.reviewCount && expert.reviewCount > 0 && expert.rating) {
    person.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: expert.rating,
      reviewCount: expert.reviewCount,
    };
  }

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: person,
  };
}

export function jobSchema(job: {
  id: string;
  title: string;
  description: string;
  postedAt: string;
  budgetMin?: number;
  budgetMax?: number;
  currency?: string;
  skills?: string[];
  clientName?: string;
}) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.postedAt,
    employmentType: "CONTRACTOR",
    directApply: true,
    url: `${appUrl}/jobs/${job.id}`,
    industry: "Workflow automation",
    skills: job.skills?.length ? job.skills.join(", ") : undefined,
    hiringOrganization: {
      "@type": "Organization",
      name: job.clientName || "Client on n8nexperts",
      sameAs: appUrl,
    },
    // Remote work still needs a stated jurisdiction to be eligible for Google
    // Jobs, so the posting declares itself worldwide rather than omitting it.
    applicantLocationRequirements: { "@type": "Country", name: "Worldwide" },
    jobLocationType: "TELECOMMUTE",
  };

  if (job.budgetMin && job.budgetMax) {
    schema.baseSalary = {
      "@type": "MonetaryAmount",
      currency: job.currency || "EUR",
      value: {
        "@type": "QuantitativeValue",
        minValue: job.budgetMin,
        maxValue: job.budgetMax,
        unitText: "PROJECT",
      },
    };
  }

  return schema;
}
