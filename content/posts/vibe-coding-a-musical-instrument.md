---
title: "Vibe coding a musical instrument"
date: "2026-05-01T15:58"
description: " Introducing the Instrument - speculative exploration of a slightly different digital musical instrument. "
tags: ["art"]
image: "https://res.cloudinary.com/duw0custw/image/upload/v1779005824/ins004_bkrsov.png"
published: true
---

I play by ear. Always have. The theory comes after, if at all. Chord shapes forgotten as soon as I stop practising, scales that make sense in my head and nowhere else. I've cycled through instruments over the years, looking for something that fits how I actually play rather than how I'm supposed to.

Some got close. Single octave, chord buttons, no theory required. An ideas machine more than an instrument. The philosophy was right: get the idea out first, worry about what it's called later. But I wanted something I could build on, extend, make strange.

So I built one. [https://anidalal.com/instrument](https://anidalal.com/instrument)

<div class="video-with-caption"><video src="https://res.cloudinary.com/duw0custw/video/upload/v1779005068/ins001_uwczxa.mov" controls></video><div class="caption-text">The Instrument</div></div>

## The build
 Started where everyone starts. Something that looked like BandLab. Two rows, piano geometry, the familiar layout. Then I started questioning the decisions I'd inherited.

Why two rows? Why the piano shape on a laptop keyboard that has nothing in common with a piano? A laptop has 40 keys. Most keyboard instruments use half of them. The rest sit there doing nothing because they don't map onto something invented in the 16th century.

![Choices: Layout diffs](https://res.cloudinary.com/duw0custw/image/upload/v1779004428/5052_okzvo2.png "Choices: Layout diffs")

So I flattened it. All four rows, every key plays something. Two modes: one where each key is the next note in the scale, you can't play a wrong note, just move and find things. One where every pitch is available, the full spread, dimmed keys showing you where the scale lives.

Everything playable as a chord or a single note. Shift between octaves. Change the root. The basics, but rebuilt from a different starting assumption.

<div class="video-with-caption"><video src="https://res.cloudinary.com/duw0custw/video/upload/v1779005068/ins002_dqph0p.mov" controls></video><div class="caption-text">Chords vs Notes</div></div>

Then I thought: I grew up playing sitar. What would this look like with Indian notations in it?

## The Indian layer
 The sitar doesn't approximate pitch. It sits inside it. Western instruments are built on a tuning system that rounds every note to the nearest acceptable compromise. A historical fix that let one instrument play in every key without retuning. It works. But it means every note is slightly off from where the physics naturally land.

Indian classical music doesn't make that compromise. It has 22 distinct pitch positions per octave rather than 12, each sitting exactly where the frequency mathematics put it. That's what I'd felt as a kid without being able to name it: a tuning difference, not a style difference.

<div class="video-with-caption"><video src="https://res.cloudinary.com/duw0custw/video/upload/v1779005700/ins003_qo91pc.mov" controls></video><div class="caption-text">Indian sounds</div></div>

So I added it. Switch between the two systems with one button. Six Indian rāgas, specific sets of notes with their own character, their own time of day, their own emotional weight. Nine Western scales. Same keyboard, same layout, different tuning underneath.

The question of how to label the Indian notes on a keyboard that also speaks Western pitch turned out to have no clean answer. Indian classical music has two traditions for how you name and notate pitch. One where the home note is fixed, one where it moves. I had to pick. I picked the fixed version because it made it easier to line up against Western notes. Most Indian classical teachers would pick differently. I'm still not sure I got that right.

## What the build revealed
 The two modes are both broken in different ways.

In the expanded mode, full spread across all four rows, the key you want is too far away. You're playing by ear, following something, and the note is physically out of reach. You have to travel and you lose the thread.

In the compressed mode, just the scale, everything close, the range is too small. The note you want exists somewhere outside the octave you're in and you can't get there.

### The instrument I actually want sits somewhere between those two that doesn't exist yet.
 That's what the build revealed. Not a solution but a sharper version of the problem.

## What's next
 The project is live at [https://anidalal.com/instrument](https://anidalal.com/instrument). Still thinking about where it goes. Audio-reactive backgrounds, looping so you can layer ideas, and many more.

And somewhere underneath all of it, the question I started with: what does a keyboard look like if it doesn't assume Western musical notation? Still open. Probably always will be.