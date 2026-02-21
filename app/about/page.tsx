import { getPopularTags } from '@/lib/posts';
import { BlogLayout } from '@/app/components/layout/BlogLayout';

export const metadata = {
  title: 'About',
  description: 'Ani Dalal — product designer and artist with 8+ years of experience.',
};

export default function AboutPage() {
  const popularTags = getPopularTags(4);

  return (
    <BlogLayout popularTags={popularTags} useLinks>
      <article className="flex-1 px-6 pt-24 pb-24 md:px-0 md:pt-0 md:pb-32">
        <header className="mb-10 lg:mb-14">
          <h1 className="text-3xl lg:text-5xl font-normal leading-snug font-[family-name:var(--font-mondwest)]">
            Ani Dalal
          </h1>
          <p className="mt-4 lg:mt-6 text-xl lg:text-2xl text-white/50">
            Product designer and artist with 8+ years of experience, currently leading design for Frameo.AI — an AI-native storytelling platform.
          </p>
        </header>

        <div className="space-y-10 text-white/90 font-[family-name:var(--font-mondwest)]">

          {/* Experience */}
          <section className="space-y-8">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-xl text-white">Product Design Lead, Frameo.AI / Dashtoon Studio</h2>
                <span className="text-base text-white/40 shrink-0 ml-4">Jun '23 – Present</span>
              </div>
              <p className="text-base lg:text-lg text-white/70 leading-relaxed">
                Leading 0→1 design for AI-native content creation platforms across comics and video, serving 20M+ users globally. Dashverse is a Peak XV-backed AI entertainment company ($13M Series A). Architected chat-first storytelling for Frameo.AI, scaled Dashtoon Studio to $1M ARR with 1.5K new users daily. Shipped "Photo to Comic" in 2 days for Meta AI Summit — showcased to Yann LeCun.
              </p>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-xl text-white">Product Designer, Univ.AI / Futureschool.AI</h2>
                <span className="text-base text-white/40 shrink-0 ml-4">Sep '20 – May '23</span>
              </div>
              <p className="text-base lg:text-lg text-white/70 leading-relaxed">
                Designed core product experiences for a learning and recruitment platform with 30,000+ users. Consolidated multiple products into one, cutting operational overhead by 40%. Built and shipped a design system that improved delivery speed by 40%.
              </p>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-xl text-white">Senior UX Designer, Samsung R&D Bangalore</h2>
                <span className="text-base text-white/40 shrink-0 ml-4">Jul '18 – Jan '20</span>
              </div>
              <p className="text-base lg:text-lg text-white/70 leading-relaxed">
                Designed experiences for Samsung's Bixby Voice Intelligence Platform across India and US markets, including voice-first interaction patterns for Bixby on Watch and an interactive storytelling service.
              </p>
            </div>
          </section>

          {/* Education */}
          <section className="space-y-4">
            <h3 className="text-white/40 text-base uppercase tracking-widest">Education</h3>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-base lg:text-lg">MDes, IIT Guwahati</span>
                <span className="text-base text-white/40 shrink-0 ml-4">2016 – 2018</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-base lg:text-lg">BTech, NIT Durgapur</span>
                <span className="text-base text-white/40 shrink-0 ml-4">2012 – 2016</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-base lg:text-lg">PG Diploma, The Terraforming, Strelka Institute</span>
                <span className="text-base text-white/40 shrink-0 ml-4">2020</span>
              </div>
            </div>
          </section>

          {/* Exhibitions */}
          <section className="space-y-4">
            <h3 className="text-white/40 text-base uppercase tracking-widest">Exhibitions</h3>
            <ul className="space-y-2 text-base lg:text-lg text-white/70">
              <li>Veha, Speculative Cartography — Tbilisi Architecture Biennale</li>
              <li>Lost in a Dreamscape — Digital Experience</li>
              <li>Fissure — Pollinator Virtual Nursery</li>
              <li>Processing Community Day, Porto</li>
              <li>Monalisa Overdrive — Generative Art</li>
              <li>#Cryptografik Exhibition</li>
              <li>Scape — Generative Art</li>
              <li>Art of Code 2022</li>
            </ul>
          </section>

          {/* Contact */}
          <section className="space-y-4">
            <h3 className="text-white/40 text-base uppercase tracking-widest">Contact</h3>
            <div className="space-y-2 text-base lg:text-lg text-white/70">
              <div><a href="mailto:anidalal3@gmail.com" className="hover:text-white transition-colors">anidalal3@gmail.com</a></div>
              <div>Bengaluru, India</div>
            </div>
          </section>

        </div>
      </article>
    </BlogLayout>
  );
}
