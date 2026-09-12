---
title: "Racing in parametric worlds | Interplanetary Racers"
date: "2026-09-10"
description: "A free browser racing game for playing with friends. Bringing together my tool-building practice, imaginary planets and procedurally generated worlds."
tags: ["art"]
image: "https://res.cloudinary.com/duw0custw/image/upload/v1788848985/Screenshot_2026-09-08_at_11.57.02_AM_gmgnhx.png"
published: true
---

I made a game. [Interplanetary Racers](/interplanetary-racers/) is a free browser space racer. Pick a spacecraft, choose a planet, and race with friends or bots through a procedurally generated world.

Here's what it looks like in motion.

<XPost id="2098465068413497432" />

## Why this game?

I wanted to make something I could play with my friends. Keeping it free and in a browser was part of that: send a link, open a room, come race.

Oban Star-Racers and Star Wars are the obvious influences. Strange flying machines, unfamiliar planets, the feeling of moving very fast through somewhere you'd quite like to explore. Racing gives that fascination something to do.

![Two racers flying alongside a cliff in Oban Star-Racers.](/images/posts/interplanetary-racers/oban-racing.jpg "Oban Star-Racers — the machines and landscapes behind the racing fantasy.")

*Image: [official Oban Star-Racers Blu-ray campaign](https://oban-star-racers-15th-anniversay-bluray.pledgebox.com/preorder).*

![Podracing in Star Wars: The Phantom Menace.](/images/posts/interplanetary-racers/starwars-racing.jpg "Star Wars: The Phantom Menace — another reference for racing through an alien landscape.")

*Image: Lucasfilm, via [StarWars.com](https://www.starwars.com/news/star-wars-inside-intel-podracing).*

## I've been making these worlds for a while

Looking at the game, I can see a direct connection to two of my earlier generative art projects, Fermi Paradox and Terra. Both were made in cables.gl in 2022.

[Fermi Paradox](/?piece=fermi-paradox) imagined UFOs as watchers of other worlds. In this iteration, a small geometric craft hangs above a mountainous patch of terrain. A little alien diorama, generated from a system I could keep playing with.

![Fermi Paradox: an orange geometric craft above a turquoise mountainous landscape.](/images/nft-previews/fermi-paradox.png "Fermi Paradox, 2022. One of my earlier experiments with spacecraft and generated landscapes.")

[Terra](/?piece=terra) imagined drones searching for habitable planets as Earth was dying. Noise and basic geometry produced different landscapes and classes of drones. The questions around planetarity that I brought back from Terraforming found a speculative setting there: what kinds of places might sustain life, and what would we send out to look for them?

![Terra: a drone among tall, dark red rock formations.](/images/nft-previews/terra.png "Terra, 2022. Drones surveying procedurally generated terrain.")

The spacecraft, the terrain, the variation were already things I was working with. With Interplanetary Racers, I wanted to put a player inside that relationship. The rocks become obstacles. The shape of a valley matters when you're trying to make a turn.

## Building the rules

My practise is [building tools](/posts/tool-making-as-an-art-practice/). I enjoy defining a system and finding out what it can produce. Here, that means deciding how much a spacecraft or landscape can change while still making sense as something you can race with or through.

The craft are assembled from parts: hulls, wings, engines, fins. Parameters change their proportions and arrangement. Each planet defines a range of terrain, colours and environmental conditions, including things like drag and gravity that affect movement.

![The craft selection screen in Interplanetary Racers.](https://res.cloudinary.com/duw0custw/image/upload/v1788848984/Screenshot_2026-09-08_at_11.57.10_AM_vuj9qv.png "Parametric parts become spacecraft you can choose and fly.")

A seed is the starting value for generating a world and its course. Change it and you get a new configuration. Keep it and you can return to the same track. In multiplayer, everyone uses that shared starting point, so you can learn a course together or try somewhere unfamiliar.

## The part that surprised me

I built this out in a couple of days using Fable. That still feels a little insane to me.

My earlier experience was manually making everything in cables.gl. Building the geometry, connecting the logic, working through how the pieces behaved together. That process was a substantial part of making Fermi Paradox and Terra.

So getting to a playable game this quickly changed my sense of what I could take on. These interests had been around for years. Now I could bring them together and try them as a game within a couple of days.

It also gave me a different way to look at those older experiments. What else in that collection could become something to play? What would I build if I could spend more of the process trying it out?

![A spacecraft racing through gates on Halcyon.](https://res.cloudinary.com/duw0custw/image/upload/v1788848984/Screenshot_2026-09-08_at_11.57.34_AM_gjtyuf.png "Interplanetary Racers — inside the world this time.")

There's still the question of how good it feels to play. Speed, steering, the camera, being able to read the next turn. Getting a game running gives me something concrete to judge and improve.

[Give it a go](/interplanetary-racers/). Bring a friend, or race the bots. I'd like to know whether you want another lap.

*Best with a keyboard. Requires a browser and device with WebGPU support.*
