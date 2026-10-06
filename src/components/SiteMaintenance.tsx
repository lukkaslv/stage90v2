import { useEffect, type CSSProperties } from 'react';

const bars = [38, 70, 48, 92, 58, 100, 74, 44, 86, 56, 96, 66, 40, 78, 52, 90, 62, 34];

export default function SiteMaintenance() {
  useEffect(() => {
    document.getElementById('initial-page-loader')?.remove();
    document.title = '#STAGE90 — ტექნიკური სამუშაოები';
  }, []);

  return (
    <main className="site-maintenance" aria-labelledby="maintenance-title">
      <div className="site-maintenance-noise" aria-hidden="true" />
      <div className="site-maintenance-glow site-maintenance-glow-pink" aria-hidden="true" />
      <div className="site-maintenance-glow site-maintenance-glow-blue" aria-hidden="true" />

      <div className="site-maintenance-shell">
        <header className="site-maintenance-header">
          <div className="site-maintenance-brand">
            <img src="/stage90-mark.svg" alt="" width="46" height="46" />
            <span><strong>STAGE 90</strong><small>ქართული მუსიკის სცენა</small></span>
          </div>
          <div className="site-maintenance-status"><span className="site-maintenance-status-dot" />ტექნიკური სამუშაოები</div>
        </header>

        <div className="site-maintenance-content">
          <section className="site-maintenance-copy">
            <div className="site-maintenance-eyebrow"><span>90</span><i />სცენა მალე დაბრუნდება</div>
            <h1 id="maintenance-title">სცენა დროებით<br /><em>ჩუმდება.</em></h1>
            <p>საიტი ტექნიკური სამუშაოების გამო დროებით დახურულია. ვამზადებთ უკეთეს სივრცეს ქართული მუსიკისთვის და მალე დავბრუნდებით.</p>
            <div className="site-maintenance-divider" aria-hidden="true"><span /></div>
            <div className="site-maintenance-note"><span className="site-maintenance-note-icon" aria-hidden="true">✦</span><span>მადლობა მოთმინებისთვის.<br /><strong>მუსიკა მალე ისევ აჟღერდება.</strong></span></div>
          </section>

          <div className="site-maintenance-art" aria-hidden="true">
            <div className="site-maintenance-orbit site-maintenance-orbit-outer" />
            <div className="site-maintenance-orbit site-maintenance-orbit-inner" />
            <div className="site-maintenance-vinyl">
              <div className="site-maintenance-vinyl-label"><span>STAGE</span><strong>90</strong><i /></div>
            </div>
            <span className="site-maintenance-art-star site-maintenance-art-star-one">✦</span>
            <span className="site-maintenance-art-star site-maintenance-art-star-two">✧</span>
            <span className="site-maintenance-art-caption">ქართული მუსიკა გრძელდება</span>
          </div>
        </div>

        <footer className="site-maintenance-footer">
          <div className="site-maintenance-equalizer" aria-hidden="true">
            {bars.map((height, index) => <i key={index} style={{ '--bar-height': `${height}%`, '--bar-delay': `${index * -0.105}s` } as CSSProperties} />)}
          </div>
          <span>პაუზა მხოლოდ დროებითია</span>
          <span className="site-maintenance-footer-mark">#STAGE90 <b>✦</b> ქართული მუსიკა</span>
        </footer>
      </div>
    </main>
  );
}
