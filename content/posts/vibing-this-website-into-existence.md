---
title: "Vibing this website into existence"
date: "2026-02-20"
description: "Your portfolio has the same problem mine did. Here's how I fixed mine — and why you can fix yours too."
tags: ["work"]
image: "https://res.cloudinary.com/duw0custw/image/upload/v1771568442/2022-portfolio-website-editor_qyh1o6.png"
---

Creating a portfolio website is hard. Keeping it alive is harder.

Most designers I know have either abandoned theirs or let it quietly stagnate. Not because they stopped doing interesting work. But because at some point, updating the site became more effort than the work itself. So they stopped.

![anidalal.net,  2021](https://res.cloudinary.com/duw0custw/image/upload/2021-portfolio-ani_oqhew9.gif "anidalal.net,  2021")

I spent years caught in the same cycle: building, outgrowing, rebuilding. Till I stopped treating it like a project to finish and started treating it like a garden to tend.

Gardens don't need perfection. They need a routine, simple tools, and consistency.

So I rebuilt this space as a tiny garden of mine. Not a static showcase. Something organic, intentional, that grows as I do. This is a walkthrough of how I did it, the thinking, the decisions, the tools. Not a tutorial. But enough that you could build something similar. And proof that you don't need to be a developer to own this.

## Why build this garden at all?
 Three years. No updates. No documentation.

![anidalal.net,  2023](https://res.cloudinary.com/duw0custw/image/upload/v1771565942/2022-portfolio-website_trwxdr.png "anidalal.net,  2023")

Not because nothing happened. But because every time I thought about adding something to my old site, the friction stopped me before I could even start. The platform didn't fit where I was anymore. Updating it felt like a project on top of the actual work. So I let it slide. Then I let it slide some more.

At some point I realized I'd lost the thread. I couldn't remember the order in which things happened. What I was thinking when I made certain decisions. Why one project led to the next. The work existed but the story connecting it had quietly disappeared.

Sound familiar?

That's what pushed me to finally build this.

Not a portfolio in the traditional sense. More like a digital journal that happens to have my work in it. Something that lives between a blog and a showcase, that tells the story instead of just displaying the outcomes. Something light enough that adding to it doesn't feel like a production. Personal enough that I actually want to.

The goal isn't to impress. It's to not lose the thread again.

And so I started making something functional without being complex. Simple enough that I'd actually use it. Clear enough to represent me honestly. And somewhere in there, delightful. Small surprises. The kind of thing that makes someone smile when they click a button.

## The ground
 The first decision was structural and the principle is simple: build a base form that can hold anything without needing complexity to feel complete.

For me that meant a fixed sidebar with three tags, and a chronological feed. One-liner tells you who I am. Tags let you filter: Work, Art, Vibes. The feed shows everything in order. Each item opens into a full page.

![anidalal.net,  2026](https://res.cloudinary.com/duw0custw/image/upload/v1771568053/2026-portfolio-website_uovoej.png "anidalal.net,  2026")

That's it. Nothing that breaks if you add a new kind of work. Nothing that requires restructuring when your thinking shifts. A base form that works with whatever you put into it.

The principle isn't about this specific layout. It's about resisting the urge to design for the portfolio you think you'll have someday. Design for the one you're maintaining tomorrow.

## The flowers
 When the structure is this restrained, the small things carry the weight. This is where personality lives and where most portfolios either overdo it or ignore it entirely.

The font is PPMondwest, a bitmap typeface inspired by classic Grotesks and Serifs. It signals elegance but feels techy, almost glitchy. Brutalist yet somehow human. That tension is exactly the aesthetic I was after: raw, authentic, classic and modern at once. The font isn't decoration. It's a decision about what kind of designer you are.

![Font, PPMondwest](https://res.cloudinary.com/duw0custw/image/upload/PPMondwest_ardztl.png "Font, PPMondwest")

Everything else follows from that same logic. Squircle clip-paths on images, that super-ellipse curve that feels handcrafted without being loud. Careful composition so the page feels considered even when it's empty. Three themes - Dawn, Day, Night, not just color swaps, each one a full personality shift. And then the micro-moments: text that scrambles when you hover a nav link, images that dissolve through a pixel grid, pages that arrive through white squares on every load. None of it interrupts. All of it rewards attention.

![anidalal.net,  reveal animation, 2026](https://res.cloudinary.com/duw0custw/image/upload/v1771601163/2026-portfolio-website_p1typr.gif "anidalal.net,  reveal animation, 2026")

A humble garden. But you notice a flower here, a flower there.

The principle: pick one thing that's unmistakably yours and let everything else follow from it. Coherence is more memorable than complexity.

## The roots
 The stack is intentionally boring: Next.js with App Router, TypeScript, Tailwind. Solid, predictable, gets out of the way.

Content lives as markdown files in `/content/posts/`. No database, no external CMS. Frontmatter handles metadata - title, date, tags, hero image. Statically exported, deployed to GitHub Pages. No server, no cost, nothing to maintain that I didn't build.

The editor lives inside the site itself - powered by Tiptap, writing straight to those markdown files. That's the whole system. Add something, it appears.

![anidalal.com, editor, 2026](https://res.cloudinary.com/duw0custw/image/upload/v1771568442/2022-portfolio-website-editor_qyh1o6.png "anidalal.com, editor, 2026")

The principle: your content system should have less friction than a notes app. If publishing feels like a deployment, you won't do it.

**Built with Claude Code. The whole thing took days, not months. I'm not a developer - but I had a clear enough vision that I could describe exactly what I wanted, piece by piece. In 2026, that's enough. Designers can now build precisely what they imagine. That's not a small thing.**

## What's grown so far
 Starting simple worked. Not just as a design principle - but as a way to actually see something through. Every step felt like a small task. Small enough to finish. Finishing felt good. Good enough to come back tomorrow.

Adding something new doesn't mean going back to the drawing board anymore. It means opening the editor and writing. The affordance is built in - growth is the path of least resistance, not the exception.

The garden is fun to tend. That was the whole point.

## What still needs planting
 It's not finished. Gardens aren't.

A post ends and there's nowhere to go - no footer, no next read waiting. The interactions are delightful but silent - sound or tactile feedback could push that further. 

These aren't failures. They're just the next things to plant.



**Your portfolio has the same problem mine did. The platform stopped fitting. The friction accumulated. The thread got lost. The bar to fixing it is lower than you think. You don't need to be a developer. You don't need months. You need a clear enough vision and simple enough tools.**



# Start with the ground. The flowers will follow.