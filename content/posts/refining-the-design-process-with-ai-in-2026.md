---
title: "Refining the design process with AI in 2026"
date: "2026-03-18T20:18"
description: "I moved the design process at Dashverse from Figma to Claude Code and GitHub. Design output doubled. Here's what that actually looks like."
tags: ["work"]
image: "https://res.cloudinary.com/duw0custw/image/upload/v1773958148/diff_rjrmol.png"
published: true
---

Before AI, design in early stage startups was mostly execution with thinking squeezed into the gaps. Pushing pixels, writing docs, building components, updating files. The actual design work - flow decisions, the hierarchy calls, the moment you notice something's wrong before you know why, happened in whatever time the execution left over.

![Frameo design process](https://res.cloudinary.com/duw0custw/image/upload/v1773934925/dp27_blqnfa.png "Frameo design process")

AI moved the execution layer. Not eliminated it. Moved it. Transcription, synthesis, wireframes, specs, prototypes. All of it faster, cheaper, running in parallel.

## For the first time, the thinking isn't squeezed into the gaps. Thinking is the job.
 So I moved the design process at Dashverse to Claude Code and GitHub instead of Figma. Here's what that process looks like on a real problem from last week.

## Problem | Scripting for micro-drama.
 Frameo already had two workflows in testing: Adaptation and Original show creation. Both assumed the episodic breakdown was done and the script, input videos, and assets were ready.

They weren't built yet.

Micro-dramas are short-form vertical video, episodic, 60-90 minutes total runtime. Getting one made involves:

```
PRE-PRODUCTION
scripting, localisation, episodic breakdown, asset generation, character and dress swap

PRODUCTION
image generation & edit, video generation & edit, audio generation & edit, video lipsync

POST-PRODUCTION
compositing, BGM & SFX, colour grading, text,  subtitles
```
Episodic breakdown is the process of deciding episode length, moving events across episodes, removing filler. It's a pre-production decision that everything downstream depends on.

Last week I was working on bringing scripting and episodic breakdown onto the platform. The two things the existing workflows assumed were already done.

## Research | AI can synthesize but can it ask the right questions?
I had some idea of the pre-production process. Claude helps formulate a rough hypothesis, the userflow model and interview guardrails. I spoke to the program manager and a script producer to form an initial opinion of the scripting process to validate my understanding and close the gaps.

**Avinash, Script Producer.** I'd modelled his role as oversight. Wrong. He was watching the video, timing, deciding what a scene becomes. The Script Master Sheet wasn't a planning doc. It was his judgment, written down. He wasn't just the reviewer after the localization and script writing was done but rather an active participant. So the scripting tool wasn't for just the writer but for both the writer and the script producer.

**Dipti, program manager.** Full pipeline view. Show comes in, Script Producer breaks it down, Writer localises, scripts get locked. Show producer reviews and two parallel tracks kick in: Asset Gen builds character refs, Clustering Team cuts the video and extracts keyframes for Adaptation.

That's where it surfaced. The Clustering Team - animators doing frame extraction occasionally skipped the script breakdown and worked from the video alone. Which led to issues downstream. 

![Scripting process](https://res.cloudinary.com/duw0custw/image/upload/v1773936831/dp28_nvhfdk.png "Scripting process")

### Insight: Move breakdown responsibility upstream to the scripting team, without making scripting more complex.
 -

## PRD | AI can draft. Scoping still takes judgment.
With the insights, I used claude to update the userflow model and create a PRD to lock in the direction. Essentially I was creating a tool that solved four things for the script producer/writer.

```
AI TRANSLATION
ability to translate script

LOCALISATION
culturally adapt character names, locations and props based on adaptation depth

EPISODE BREAKDOWN
reorder, delete, merge scenes to create a new episode breakdown for the adapted content

SCRIPT FINALISATION & LOCKING
review and finalize script for asset generation and downstream processes
```
AI models have context issues. So I prefer detailed documentation that is continuously updated throughout the design process. It serves as the reference document directing claude code during the exploration and building phase.

![Clauding a PRD into existence](https://res.cloudinary.com/duw0custw/image/upload/v1773959015/PRD_lenydx.png "Clauding a PRD into existence")

## Ideation | The flow comes fast. Vision is another story.
The Descript editor design pattern seemed like a good fit, amongst the other tools they used like Final Draft, Google Docs, sheets on the basis of the gathered insights. 

![Descript video editor](https://res.cloudinary.com/duw0custw/image/upload/v1773949823/Descript_ssva88.png "Descript video editor")

I went ahead and built a v1 using the Claude Code CLI by passing it the detailed PRD and an image reference from Descript. 

![Script tool v1](https://res.cloudinary.com/duw0custw/image/upload/v1773950885/Script_tool_v1_ylwpww.png "Script tool v1")

It was pretty bad. It got a few things correct like the split screen view, editability of the text, timeline etc but it was pretty unusable. But this first prototype revealed a couple of obvious drawbacks of this approach. Descript is a video editor, it has only dialogues, the text based video editor was WYSIWYG model. 

Conceptually, the script on the left and the video on the right worked. But the writer needed to rewrite entire sections, localise characters and locations, adhere to the industry standard script format and capture the episodic breakdown somewhere. 

A Figma prototype for the same thing would have taken me a lot longer and the realization that I was offtrack would have been delayed. 

### That's the speed gain. Not just faster wireframes. Faster iterations leading to faster review cycles and better design decisions.
-

## Design decisions | Options are easy to generate. The argument for one isn't.
Using Figma for design meant going back and forth across keyframes before you got anywhere near a prototype. By the time you did, the execution had worn out your judgment. Now the prototype is the first thing you make. Minutes after forming a direction, not weeks. Fresh eyes on a real thing resulted in much better design decisions early on.

The structural problem was precise: script and video in two places resulted in breakdown decisions made without context. The Clustering Team worked blind. So the operating principle for me was: 

### Writing is the centre of gravity. Everything else is a consequence.
![50/50 split inspired by descript](https://res.cloudinary.com/duw0custw/image/upload/v1773957746/5050_uxg6um.png "50/50 split inspired by descript")

**50/50 layout.** Script is the output. Video is reference. The writer needs to watch and write simultaneously.

![Character chips](https://res.cloudinary.com/duw0custw/image/upload/v1773957762/Charchips_clivrg.png "Character chips")

**Character chips.** The team recorded the localised elements. The chip is that equivalent column from google sheets made structural.

**Auto-transcribe.** AI transcribes the source language in the standard script format. Starting point for localisation.

![Translate](https://res.cloudinary.com/duw0custw/image/upload/v1773957772/Translate_wtdeph.png "Translate")

**AI translation.** Translate to target language. 

**Retain script formatting.** Markdown output means the screenplay could across platforms without losing formatting.

![/ commands](https://res.cloudinary.com/duw0custw/image/upload/v1773958038/slash_ywil9u.png "/ commands")

**/ for script blocks.** Type `/` anywhere for Scene Heading, Action, Character, Dialogue, Parenthetical. Script-specific formatting inspired by Notion.

![Comments for review](https://res.cloudinary.com/duw0custw/image/upload/v1773958043/comments_1_mmsaea.png "Comments for review")

**Comments.** Inline threads per line. Script Producer and Writer resolve in the tool, not over Slack.

![Diffs inspired by coding platforms](https://res.cloudinary.com/duw0custw/image/upload/v1773958148/diff_rjrmol.png "Diffs inspired by coding platforms")

**Diff view.** The divergence between OG and localised content, and accomodating changes post review is the work. Show it.

**Vertical scroll across episodes.** Episodic breakdown is a continuity decision. Writers need to see across episodes, not switch between tabs. Continuous scroll with episode markers.

**Timeline - episodes stacked left to right.** Same reason. The breakdown is a horizontal decision: which scenes move, merge, get cut. Left-to-right reflects that.

![Episode breakdown and delete markers](https://res.cloudinary.com/duw0custw/image/upload/v1773958355/mark_delete_m7oycb.png "Episode breakdown and delete markers")

**Marking tool on timeline.** Drag to select, mark red. Breakdown decisions happen while watching, so the cut lives on the timeline, not in a planning doc. Directly from Avinash.

**Annotation tool.** Mark episodic breakdown decisions against the timeline. What became episode 1, what got merged into episode 3. The Script Master Sheet, previously a manually created input, becomes the export of this layer.

This didn't happen all at once, but in layers, over a couple of claude code sessions. But these decisions were made over 2 days and not over a month. I think that's the single biggest win of using AI for the design process. It freed up enough time to actually do the design thinking effectively, instead of being bogged down in execution. 

<div class="video-with-caption"><video src="https://res.cloudinary.com/duw0custw/video/upload/v1773958862/Demoscript_fop3q1.mov" controls></video><div class="caption-text">Demo video</div></div>

## Testing & Validation | Feedback clusters fast. Being in the room still matters.
A few versions later after accomodating all the design decisions, I showed Rahul the prototype. He is a script supervisor working with three writers. I started the conversation by diving into his process and trying to get deeper into specific parts to ensure if there was anything that I had missed. 

I could see a lot of gaps still that needed work. Like zoom in and out options for the timeline, the need for handling multiuser episode marking for the team, making the characters and locations more interactive - grouping and mapping them to images from the video or adding comments on the timeline as well. But I had been able to cover a lot of the other important cases that I surely would have missed earlier back in Figma days. 

Post the conversation, I sent Rahul a link to playtest the flow. Its an autogenerated link deployed everytime a PR is raised for review and testing purposes before its merged. 

## Handoff: AI handles almost all of it.
![Github PR for the version awaiting review](https://res.cloudinary.com/duw0custw/image/upload/v1773956746/PR_script_bfyi6o.png "Github PR for the version awaiting review")


No Figma thread. No "which version is current." Spec in the repo. Decisions have timestamps. Engineers build from the spec directly, no interpreting required.

Handoff was always the most mechanical stage. AI ate almost all of it. Which is fine. It was never where design lived. Resolving conflicts can occasionally be a pain but that's still better than having to define and document everything manually for dev.

The process didn't change. Research is still research. Scoping is still a judgment call. Building is still how you find out you're wrong. Testing is still when your assumptions meet reality.

### What changed is where the time goes: the execution that used to eat up most of the time is gone, and what's left is the part that was always the actual job, the 'fun' part, and it always will be.