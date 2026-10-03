interface Props { onFaq: () => void; onAbout: () => void; }

export default function SiteFooter({ onFaq, onAbout }: Props) {
  return <footer className="stage-site-footer border-t border-[#31333a]">
    <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
      <p className="text-xs text-gray-400">© 2026 #STAGE90. ეს არის კავშირი. ყველა უფლება დაცულია.</p>
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <button type="button" onClick={onFaq} className="hover:text-white">წესები და კითხვები</button>
        <button type="button" onClick={onAbout} className="hover:text-white">კავშირი</button>
      </div>
    </div>
  </footer>;
}
