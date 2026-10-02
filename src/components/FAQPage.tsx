import { CalendarDays, ChevronDown, CircleHelp, Disc3, ListMusic, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

interface Question {
  question: string;
  answer: ReactNode;
}

interface QuestionGroup {
  id: string;
  title: string;
  description: string;
  icon: typeof CircleHelp;
  questions: Question[];
}

const groups: QuestionGroup[] = [
  {
    id: 'platform',
    title: 'პლატფორმის შესახებ',
    description: 'გაიგეთ, რას აკეთებს Stage 90 და როგორ მიიღოთ მონაწილეობა.',
    icon: CircleHelp,
    questions: [
      {
        question: 'რა არის Stage 90?',
        answer: 'Stage 90 ქართული მუსიკის აღმოჩენისა და განხილვის სივრცეა. აქ შეგიძლიათ გაეცნოთ რელიზებს, წაიკითხოთ რეცენზიები, შეაფასოთ ნამუშევრები და ნახოთ საზოგადოების, მედიისა და ავტორების განსხვავებული მოსაზრებები.',
      },
      {
        question: 'ვის შეუძლია მუსიკის შეფასება?',
        answer: 'რელიზის შესაფასებლად საჭიროა ანგარიშში შესვლა. შეფასების დატოვება შეუძლიათ პლატფორმის რეგისტრირებულ წევრებს.',
      },
      {
        question: 'როგორ იქმნება ანგარიში?',
        answer: 'რეგისტრაციისას გაგზავნეთ განაცხადი და მიუთითეთ თქვენი Instagram-ის ან YouTube-ის პროფილი. ადმინისტრატორი ამოწმებს განაცხადს. დამტკიცების შემდეგ ელ-ფოსტით მიიღებთ მოწვევას და შექმნით პაროლს. განაცხადის გაგზავნა ანგარიშს ჯერ არ ქმნის.',
      },
    ],
  },
  {
    id: 'ratings',
    title: 'შეფასება და რეცენზიები',
    description: 'ქულები, საფეხურები და მოსაზრებების გამოქვეყნების წესები.',
    icon: Disc3,
    questions: [
      {
        question: 'როგორ მუშაობს 90-ქულიანი შეფასება?',
        answer: 'შეაფასე შენი მოსმენის გამოცდილება ოთხი დამოუკიდებელი ნიშნით: გამოძახილი — რა რეაქციას იწვევს მუსიკა; ჩართულობა — რამდენად ერთვები განცდაში; ჩაძირვა — რამდენად იპყრობს მუსიკა შენს ყურადღებას; გარდაქმნა — რამდენად ცვლის შენს შინაგან მდგომარეობას. თითოეულს 1–10 ქულა ენიჭება. ატმოსფეროს ხუთი დონე ცალკე გავლენას ახდენს საბოლოო ქულაზე. მაქსიმუმია 90 ქულა.',
      },
      {
        question: 'როგორ ავირჩიო ქულები და ატმოსფეროს დონე?',
        answer: 'ყოველი ნიშნისთვის 1 ნიშნავს თითქმის არარსებულ განცდას, 5 — შესამჩნევ განცდას, 10 — განსაკუთრებით ძლიერს. შუალედური ქულებიც თავისუფლად აირჩიე. ნიშნები თანმიმდევრული ეტაპები არ არის: შეიძლება მუსიკაში ღრმად ჩაიძირო ძლიერი ემოციური ჩართულობის გარეშეც. ატმოსფერო გამოხატავს შენთვის მუსიკალური სამყაროს მთლიანობას, გამომსახველობასა და ძალას და არა მის სიხარულს, სევდას ან სხვა სავალდებულო განწყობას.',
      },
      {
        question: 'ნიშნავს თუ არა მაღალი ქულა, რომ მუსიკა ყველასთვის საუკეთესოა?',
        answer: 'არა. ქულა მსმენელის პირად განცდას გამოხატავს და სწორი ემოციური პასუხი არ არსებობს. მუსიკით გამოწვეული სევდა, შფოთვა, სიმშვიდე ან სიხარული თანაბრად ღირებული გამოცდილებაა. ძველი რეცენზიები იმ დროის ტექნიკური კრიტერიუმებით დაიწერა; მათი ქულები უცვლელია და ახალ ნიშნებს არ უნდა გაუთანაბრდეს.',
      },
      {
        question: 'რა განსხვავებაა პერსონალურ, საზოგადოების და მედიის შეფასებებს შორის?',
        answer: <><strong className="font-semibold text-white">პერსონალური</strong> არის შენ მიერ მინიჭებული ქულა. ის ერთჯერადად შედის საერთო საშუალოში და შენი როლის შესაბამის ჯგუფშიც: მომხმარებლის, ავტორისა და ადმინისტრატორის ქულა — საზოგადოების; მედიის წარმომადგენლისა — მედიის საშუალოში. <strong className="font-semibold text-white">საერთო ქულა</strong> ყველა რეცენზიის საშუალოა, თითოეული რეცენზია თანაბრად ითვლება. ჯგუფები მხოლოდ ავტორს განასხვავებს; არც ერთი ქულა არ არის უფრო სწორი ან ობიექტური.</>,
      },
      {
        question: 'რას ნიშნავს ვერცხლი, ოქრო, ზურმუხტი, საფირონი და ლალი?',
        answer: 'საფეხური ყველა გამოქვეყნებული რეცენზიის საერთო საშუალო ქულით განისაზღვრება: 50 ქულამდე — ვერცხლი, 50–64 — ოქრო, 65–74 — ზურმუხტი, 75–84 — საფირონი, 85–90 — ლალი. ყოველი რეცენზია ერთხელ ითვლება, ავტორის როლის მიუხედავად. თუ რელიზს ჯერ არავინ შეაფასა, საფეხური არ ენიჭება. საფეხური რეცენზიის წაკითხვისა და მუსიკის მოსმენის შემცვლელი არ არის.',
      },
      {
        question: 'შემიძლია უკვე გამოქვეყნებული შეფასების შეცვლა?',
        answer: 'დიახ. თუ იმავე რელიზზე შეფასებას ხელახლა გაგზავნით, თქვენი არსებული შეფასება განახლდება.',
      },
      {
        question: 'რა წესები მოქმედებს რეცენზიის დაწერისას?',
        answer: 'რეცენზია უნდა იყოს შინაარსიანი და დასაბუთებული. დაუშვებელია შეურაცხყოფა, უცენზურო ლექსიკა, რეკლამა და ბმულები. ტექსტი თავად დაწერეთ — პლატფორმის წესები ხელოვნური ინტელექტით გენერირებულ რეცენზიებს არ ითვალისწინებს.',
      },
    ],
  },
  {
    id: 'discover',
    title: 'სიები და აღმოჩენა',
    description: 'როგორ ყალიბდება ტოპ სიები და როგორ ჩნდებიან ახალი სახელები.',
    icon: ListMusic,
    questions: [
      {
        question: 'როგორ დგება ყველა დროის ტოპ რელიზების სია?',
        answer: 'ამჟამად სია რელიზებზე დაწერილი რეცენზიების რაოდენობით დგება. ამიტომ ის, პირველ რიგში, აჩვენებს, რომელ ნამუშევრებს მოჰყვა მეტი განხილვა და არა იმას, რომელმა მიიღო ყველაზე მაღალი საშუალო ქულა.',
      },
      {
        question: 'რას აჩვენებს ბოლო 24 საათის ტოპ‑15?',
        answer: 'ამ სიაში ხვდება აქტიური რელიზები, რომლებმაც ბოლო 24 საათში ყველაზე მეტი რეცენზია მიიღეს. სია აჩვენებს მიმდინარე აქტივობას და დროთა განმავლობაში იცვლება.',
      },
      {
        question: 'რა არის მონაწილეთა ტოპ‑90?',
        answer: 'ეს პლატფორმის მონაწილეთა რეიტინგია საზოგადოების ქულების მიხედვით. ის ასახავს მონაწილეობას პლატფორმის ცხოვრებაში; მუსიკოსების ნამუშევრების ხარისხის რეიტინგი არ არის.',
      },
      {
        question: 'როგორ ხვდება მუსიკოსი „ახალი სახელების“ განყოფილებაში?',
        answer: 'განყოფილება ახალი და დამოუკიდებელი ქართველი მუსიკოსების აღმოჩენას ემსახურება. შერჩევისას ყურადღება ექცევა ნამუშევრის ხარისხს, თვითმყოფადობას, მუსიკოსის აქტიურობასა და საზოგადოების ინტერესს. განყოფილებაში გამოჩენა ავტომატურად მხოლოდ მაღალი ქულის მიღებაზე არ არის დამოკიდებული.',
      },
    ],
  },
  {
    id: 'events',
    title: 'ღონისძიებები',
    description: 'კონცერტები, ტურები და ფესტივალები ერთ სივრცეში.',
    icon: CalendarDays,
    questions: [
      {
        question: 'სად ვნახო კონცერტები და ფესტივალები?',
        answer: 'ღონისძიებები თავმოყრილია „კონცერტების“ განყოფილებაში. იქ შეგიძლიათ ნახოთ გამოქვეყნებული კონცერტების, ტურებისა და ფესტივალების ინფორმაცია.',
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.09),transparent_60%)]" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mb-12 max-w-3xl sm:mb-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/5 px-3 py-1 text-xs font-semibold text-blue-300">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            ყველაფერი Stage 90-ის შესახებ
          </span>
          <h1 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">ხშირად დასმული <span className="text-blue-300">კითხვები</span></h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-gray-400">პასუხები პლატფორმაზე, შეფასებაზე, რეიტინგებსა და ღონისძიებებზე.</p>
          <div className="mt-8 h-px w-full bg-gradient-to-r from-blue-400/50 via-pink-400/30 to-transparent" />
        </div>

        <div className="grid gap-10 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-14">
          <nav aria-label="კითხვების თემები" className="lg:sticky lg:top-36 lg:self-start">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">თემები</p>
            <div className="flex flex-wrap gap-2 lg:flex-col">
              {groups.map((group, index) => (
                <a key={group.id} href={`#${group.id}`} className="inline-flex items-center gap-3 rounded-lg border border-[#272730] bg-[#121215] px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-blue-400/40 hover:bg-blue-400/5 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 lg:w-full">
                  <span className="font-mono text-xs text-blue-400/70">{String(index + 1).padStart(2, '0')}</span>
                  {group.title}
                </a>
              ))}
            </div>
          </nav>

          <div className="space-y-14">
            {groups.map((group, groupIndex) => {
              const Icon = group.icon;
              return (
                <section key={group.id} id={group.id} className="scroll-mt-36">
                  <div className="mb-6 flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-400/10 text-blue-300">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="mb-1 text-xs font-semibold tracking-widest text-blue-400/70">{String(groupIndex + 1).padStart(2, '0')} / {String(groups.length).padStart(2, '0')}</p>
                      <h2 className="text-xl font-bold text-white sm:text-2xl">{group.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-gray-500">{group.description}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {group.questions.map(({ question, answer }, index) => (
                      <details key={question} className="group rounded-xl border border-[#292932] bg-[#121215] transition-colors open:border-blue-400/35 open:bg-[#15191d]">
                        <summary className="flex cursor-pointer list-none items-center gap-4 rounded-xl px-5 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 sm:px-6 [&::-webkit-details-marker]:hidden">
                          <span className="shrink-0 font-mono text-xs text-gray-600 group-open:text-blue-400/70">{String(index + 1).padStart(2, '0')}</span>
                          <span className="min-w-0 flex-1 text-sm font-semibold leading-6 text-gray-100 sm:text-base">{question}</span>
                          <ChevronDown className="h-5 w-5 shrink-0 text-gray-500 transition-transform group-open:rotate-180 group-open:text-blue-300" aria-hidden="true" />
                        </summary>
                        <div className="border-t border-[#292932] px-5 pb-6 pt-5 sm:px-6">
                          <p className="pl-8 text-sm leading-7 text-gray-300 sm:text-base sm:leading-8">{answer}</p>
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
