import Link from "next/link";
import { CheckCircle2, MapPin, Star } from "lucide-react";
import type { ExpertProfile } from "@/lib/types";

export function ExpertCard({ expert }: { expert: ExpertProfile }) {
  return <article className="expert-card card">
    <div className="expert-top"><img className="avatar avatar-lg" src={expert.photoUrl} alt={`${expert.name} profile`} />
      <div className="expert-identity"><div className="expert-name-line"><Link href={`/experts/${expert.slug}`}>{expert.name}</Link>{expert.verified && <CheckCircle2 className="verified-icon" size={17} aria-label="Profile reviewed"/>}</div>
      <p>{expert.title}</p><div className="muted-row"><MapPin size={14}/>{expert.location}</div></div>
    </div>
    <p className="clamp-3">{expert.bio}</p>
    <div className="chip-row">{expert.skills.slice(0,4).map(skill => <span className="chip" key={skill}>{skill}</span>)}</div>
    <div className="expert-meta"><div><Star size={15} fill="currentColor"/><strong>{expert.rating}</strong><span>({expert.reviewCount})</span></div><div><strong>€{expert.hourlyRate}/hr</strong></div></div>
    <div className="card-footer"><span className="availability-dot"></span><span>{expert.availability}</span><Link className="button button-secondary button-sm" href={`/experts/${expert.slug}`}>View profile</Link></div>
  </article>;
}
