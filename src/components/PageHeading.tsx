import type { ReactNode } from 'react';

export default function PageHeading({ title, description, aside }: { title: string; description?: string; aside?: ReactNode }) {
  return <header className="stage-page-heading mb-8 flex flex-wrap items-end justify-between gap-4">
    <div>
      <p className="stage-page-kicker">STAGE 90 <span aria-hidden="true">/</span> ქართული მუსიკის სცენა</p>
      <h1 className="stage-page-title">{title}</h1>
      {description && <p className="stage-page-description">{description}</p>}
    </div>
    {aside}
  </header>;
}
