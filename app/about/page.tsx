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
          <h1 className="text-3xl lg:text-5xl font-normal leading-snug">
            Ani Dalal
          </h1>
          <p className="mt-4 lg:mt-6 text-xl lg:text-2xl text-white/50">
            Product designer and artist with 8+ years of experience, currently leading design for Frameo.AI — an AI-native storytelling platform.
          </p>
        </header>

        <div className="space-y-12">

          {/* Experience */}
          <section className="space-y-6">
            <h2 className="text-xl text-white/40">Experience</h2>
            <div className="space-y-4">
              {[
                { role: 'Product Design Lead', company: 'Frameo.AI / Dashtoon Studio', period: "Jun '23 – Present" },
                { role: 'Product Designer', company: 'Univ.AI / Futureschool.AI', period: "Sep '20 – May '23" },
                { role: 'Senior UX Designer', company: 'Samsung R&D Bangalore', period: "Jul '18 – Jan '20" },
                { role: 'Freelance', company: 'UX, product design, web development', period: 'Various' },
              ].map(({ role, company, period }) => (
                <div key={role} className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xl text-white">{role}</span>
                    <span className="text-xl text-white/50">, {company}</span>
                  </div>
                  <span className="text-xl text-white/40 shrink-0 ml-6">{period}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Education */}
          <section className="space-y-6">
            <h2 className="text-xl text-white/40">Education</h2>
            <div className="space-y-4">
              {[
                { degree: 'MDes', school: 'IIT Guwahati', period: '2016 – 2018' },
                { degree: 'BTech', school: 'NIT Durgapur', period: '2012 – 2016' },
                { degree: 'PG Diploma, The Terraforming', school: 'Strelka Institute', period: '2020' },
              ].map(({ degree, school, period }) => (
                <div key={degree} className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xl text-white">{degree}</span>
                    <span className="text-xl text-white/50">, {school}</span>
                  </div>
                  <span className="text-xl text-white/40 shrink-0 ml-6">{period}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Exhibitions */}
          <section className="space-y-6">
            <h2 className="text-xl text-white/40">Exhibitions</h2>
            <div className="space-y-4">
              {[
                { title: 'Veha, Speculative Cartography', venue: 'Tbilisi Architecture Biennale', year: '2021' },
                { title: 'Lost in a Dreamscape', venue: 'Digital Experience', year: '2021' },
                { title: 'Fissure', venue: 'Pollinator Virtual Nursery', year: '2020' },
                { title: 'Processing Community Day', venue: 'Porto', year: '2021' },
                { title: 'Monalisa Overdrive', venue: 'Generative Art', year: '2022' },
                { title: '#Cryptografik Exhibition', venue: '', year: '2021' },
                { title: 'Scape', venue: 'Generative Art', year: '' },
                { title: 'Art of Code', venue: '', year: '2022' },
              ].map(({ title, venue, year }) => (
                <div key={title} className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xl text-white">{title}</span>
                    {venue && <span className="text-xl text-white/50">, {venue}</span>}
                  </div>
                  {year && <span className="text-xl text-white/40 shrink-0 ml-6">{year}</span>}
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
