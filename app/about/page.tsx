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
      <article className="flex-1 px-6 pt-24 pb-24 md:px-0 md:pt-0 md:pb-32 font-[family-name:var(--font-mondwest)]">
        <header className="mb-12 lg:mb-16">
          <h1 className="text-3xl md:text-[40px] font-light leading-snug text-white">
            Product designer and artist with 8+ years of experience, currently building AI native tools for the future
          </h1>
        </header>

        <div className="space-y-12">

          {/* Experience */}
          <section className="space-y-6">
            <h2 className="text-xl text-white/40">Experience</h2>
            <div className="space-y-6">
              {[
                { company: 'Dashverse.AI', desc: '0 to 1 product design for Frameo', period: "Jan '25 - Present" },
                { company: 'Dashverse.AI', desc: '0 to 1 product design for Dashtoon Studio', period: "Jun '23 - Dec '24" },
                { company: 'Univ.AI', desc: 'Product design for learning & recruitment platform', period: "Sep '20 - May '23" },
                { company: 'Samsung R&D', desc: 'UX design for Bixby voice platform', period: "Jul '18 - Jan '20" },
                { company: 'Freelance', desc: 'UX strategy, product design and web development', period: 'Various' },
              ].map(({ company, desc, period }) => (
                <div key={company + desc} className="flex items-start justify-between gap-6">
                  <div>
                    <div className="text-xl text-white">{company}</div>
                    <div className="text-xl text-white/50">{desc}</div>
                  </div>
                  <span className="text-xl text-white/40 shrink-0">{period}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Education */}
          <section className="space-y-6">
            <h2 className="text-xl text-white/40">Education</h2>
            <div className="space-y-6">
              {[
                { school: 'IIT Guwahati', degree: 'MDes', period: '2016 - 2018' },
                { school: 'NIT Durgapur', degree: 'BTech', period: '2012 - 2016' },
                { school: 'Strelka Institute', degree: 'PG Diploma, The Terraforming', period: '2020' },
              ].map(({ school, degree, period }) => (
                <div key={school} className="flex items-start justify-between gap-6">
                  <div>
                    <div className="text-xl text-white">{school}</div>
                    <div className="text-xl text-white/50">{degree}</div>
                  </div>
                  <span className="text-xl text-white/40 shrink-0">{period}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Exhibitions */}
          <section className="space-y-6">
            <h2 className="text-xl text-white/40">Exhibitions</h2>
            <div className="space-y-6">
              {[
                { title: 'Veha, Speculative Cartography', venue: 'Tbilisi Architecture Biennale', year: '2021' },
                { title: 'Lost in a Dreamscape', venue: 'Digital Experience', year: '2021' },
                { title: 'Fissure', venue: 'Pollinator Virtual Nursery', year: '2020' },
                { title: 'Processing Community Day', venue: 'Porto', year: '2021' },
                { title: 'Monalisa Overdrive', venue: 'Generative Art', year: '2022' },
                { title: '#Cryptografik Exhibition', venue: '', year: '2021' },
                { title: 'Scape', venue: 'Generative Art', year: '2022' },
                { title: 'Art of Code', venue: '', year: '2022' },
              ].map(({ title, venue, year }) => (
                <div key={title} className="flex items-start justify-between gap-6">
                  <div>
                    <div className="text-xl text-white">{title}</div>
                    {venue && <div className="text-xl text-white/50">{venue}</div>}
                  </div>
                  {year && <span className="text-xl text-white/40 shrink-0">{year}</span>}
                </div>
              ))}
            </div>
          </section>

          {/* Contact */}
          <section className="space-y-6">
            <h2 className="text-xl text-white/40">Contact</h2>
            <div className="space-y-4">
              <div className="text-xl">
                <a href="mailto:anidalal3@gmail.com" className="text-white hover:text-white/70 transition-colors">anidalal3@gmail.com</a>
              </div>
              <div className="text-xl text-white/50">Bengaluru, India</div>
            </div>
          </section>

        </div>
      </article>
    </BlogLayout>
  );
}
