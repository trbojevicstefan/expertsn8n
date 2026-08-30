import Link from "next/link";
import { CheckCircle2, MapPin, Star } from "lucide-react";
import type { ExpertProfile } from "@/lib/types";
import { Avatar } from "./avatar";

export function ExpertCard({ expert }: { expert: ExpertProfile }) {
  const hasRating = expert.reviewCount > 0;
  const hasRate = expert.hourlyRate > 0;

  return (
    <article className="expert-card card">
      <div className="expert-top">
        <Avatar name={expert.name} src={expert.photoUrl} />
        <div className="expert-identity">
          <div className="expert-name-line">
            <Link href={`/experts/${expert.slug}`}>{expert.name}</Link>
            {expert.verified && (
              <CheckCircle2 className="verified-icon" size={17} aria-label="Profile reviewed" />
            )}
          </div>
          <p>{expert.title}</p>
          {expert.location && (
            <div className="muted-row"><MapPin size={14} />{expert.location}</div>
          )}
        </div>
      </div>

      <p className="clamp-3">{expert.bio}</p>

      <div className="chip-row">
        {expert.skills.slice(0, 4).map((skill) => <span className="chip" key={skill}>{skill}</span>)}
      </div>

      <div className="expert-meta">
        <div>
          {hasRating ? (
            <>
              <Star size={15} fill="currentColor" />
              <strong>{expert.rating}</strong>
              <span>({expert.reviewCount})</span>
            </>
          ) : (
            <span className="meta-quiet">No marketplace history yet</span>
          )}
        </div>
        <div>
          <strong>{hasRate ? `€${expert.hourlyRate}/hr` : "Rate on request"}</strong>
        </div>
      </div>

      <div className="card-footer">
        {expert.availability ? (
          <>
            <span className="availability-dot" />
            <span>{expert.availability}</span>
          </>
        ) : (
          <span className="meta-quiet">Availability on request</span>
        )}
        <Link className="button button-secondary button-sm" href={`/experts/${expert.slug}`}>
          View profile
        </Link>
      </div>
    </article>
  );
}
