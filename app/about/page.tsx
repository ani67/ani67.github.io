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
                { company: 'Dashverse.AI', desc: '0 to 1 product design for Frameo & Dashtoon Studio', period: "Jun '23 - Present" },
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
                { school: 'Indian Institute of Technology Guwahati', degree: 'Master of Design', period: '2016 - 2018' },
                { school: 'National Institute of Technology Durgapur', degree: 'Bachelor of Technology', period: '2012 - 2016' },
                { school: 'Strelka Institute for Media, Architecture and Design', degree: 'The Terraforming — Post Graduate Diploma', period: '2020' },
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

          {/* Teaching & Juries */}
          <section className="space-y-6">
            <h2 className="text-xl text-white/40">Teaching & Juries</h2>
            <div className="space-y-6">
              {[
                { org: 'IIT Guwahati', role: 'Led two 3-hour generative art workshops', period: "2024 - 25" },
                { org: 'CEPT University', role: 'Jury member, Worldbuilding studio finals', period: "2025" },
              ].map(({ org, role, period }) => (
                <div key={org + role} className="flex items-start justify-between gap-6">
                  <div>
                    <div className="text-xl text-white">{org}</div>
                    <div className="text-xl text-white/50">{role}</div>
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
                { event: 'Art of Code', work: 'Scape, Generative Art', year: '2022' },
                { event: 'Tbilisi Architecture Biennale', work: 'Veha, Speculative Cartography', year: '2021' },
                { event: 'Processing Community Day, Porto', work: 'Lost in a Dreamscape, Digital Experience', year: '2021' },
                { event: '#Cryptografik Exhibition', work: 'Monalisa Overdrive, Generative Art', year: '2021' },
                { event: 'Pollinator Virtual Nursery', work: 'Fissure', year: '2020' },
              ].map(({ event, work, year }) => (
                <div key={event} className="flex items-start justify-between gap-6">
                  <div>
                    <div className="text-xl text-white">{event}</div>
                    <div className="text-xl text-white/50">{work}</div>
                  </div>
                  <span className="text-xl text-white/40 shrink-0">{year}</span>
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
