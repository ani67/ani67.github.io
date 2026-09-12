---
title: "Racing in parametric worlds | Interplanetary Racers"
date: "2026-09-10"
description: "A free browser racing game for playing with friends. Built in a couple of days using Fable, drawing on my earlier generative art experiments."
tags: ["art"]
image: "https://res.cloudinary.com/duw0custw/image/upload/v1788848985/Screenshot_2026-09-08_at_11.57.02_AM_gmgnhx.png"
published: true
---

I made a game. [Interplanetary Racers](/interplanetary-racers/) is a free browser space racer. Pick a spacecraft, choose a planet, and race with friends or bots through a procedurally generated world.

Here's what it looks like in motion.

<XPost id="2098465068413497432" />

## Why this game?

I wanted to make something I could play with my friends. Keeping it free and in a browser was part of that: send a link, open a room, come race.

I kept coming back to the flying machines and planets in Oban Star-Racers and Star Wars. I wanted to make a game where I could fly through places like those.

![Two racers flying alongside a cliff in Oban Star-Racers.](/images/posts/interplanetary-racers/oban-racing.jpg "A race in Oban Star-Racers.")

*Image: [official Oban Star-Racers Blu-ray campaign](https://oban-star-racers-15th-anniversay-bluray.pledgebox.com/preorder).*

![Podracing in Star Wars: The Phantom Menace.](/images/posts/interplanetary-racers/starwars-racing.jpg "Podracing in Star Wars: The Phantom Menace.")

*Image: Lucasfilm, via [StarWars.com](https://www.starwars.com/news/star-wars-inside-intel-podracing).*

## I've been making these worlds for a while

Looking at the game, I can see a direct connection to two of my earlier generative art projects, Fermi Paradox and Terra. Both were made in cables.gl in 2022.

[Fermi Paradox](/?piece=fermi-paradox) imagined UFOs as watchers of other worlds. In this iteration, a small geometric craft hangs above a mountainous patch of terrain. Changing the parameters gave me different versions of the craft and its surroundings.

![Fermi Paradox: an orange geometric craft above a turquoise mountainous landscape.](/images/nft-previews/fermi-paradox.png "Fermi Paradox, 2022. One of my earlier experiments with spacecraft and generated landscapes.")

[Terra](/?piece=terra) imagined drones searching for habitable planets as Earth was dying. Noise and basic geometry produced different landscapes and classes of drones. After Terraforming, I was thinking about planetarity and what makes a planet habitable. Terra let me explore that through imagined landscapes and the machines sent to survey them.

![Terra: a drone among tall, dark red rock formations.](/images/nft-previews/terra.png "Terra, 2022. Drones surveying procedurally generated terrain.")

Interplanetary Racers gave me a reason to revisit those experiments. This time, someone has to steer through the terrain. A rock formation can block your path, and a narrow valley makes a turn harder.

## Building the rules

My practise is [building tools](/posts/tool-making-as-an-art-practice/). I enjoy defining a system and finding out what it can produce. Here, that means deciding how much a spacecraft or landscape can change while still making sense as something you can race with or through.

The craft are assembled from parts: hulls, wings, engines, fins. Parameters change their proportions and arrangement. Each planet defines a range of terrain, colours and environmental conditions, including things like drag and gravity that affect movement.

![The craft selection screen in Interplanetary Racers.](https://res.cloudinary.com/duw0custw/image/upload/v1788848984/Screenshot_2026-09-08_at_11.57.10_AM_vuj9qv.png "Parametric parts become spacecraft you can choose and fly.")

A seed is the starting value for generating a world and its course. Change it and you get a new configuration. Keep it and you can return to the same track. In multiplayer, everyone uses that shared starting point, so you can learn a course together or try somewhere unfamiliar.

## The part that surprised me

I built this out in a couple of days using Fable. That still feels a little insane to me.

With Fermi Paradox and Terra, I had manually built the geometry and connected the logic in cables.gl. I was used to spending time on each of those pieces myself.

I hadn't expected to get from those experiments to a playable multiplayer game so quickly. It makes me want to go back through my older work and see what else I could turn into a game.

![A spacecraft racing through gates on Halcyon.](https://res.cloudinary.com/duw0custw/image/upload/v1788848984/Screenshot_2026-09-08_at_11.57.34_AM_gjtyuf.png "Racing through gates on Halcyon.")

Having it running is only the start. I still need to judge how the steering feels, whether the camera helps, and whether you can see the next turn in time.

[Give it a go](/interplanetary-racers/). Bring a friend, or race the bots. I'd like to know whether you want another lap.

*Best with a keyboard. Requires a browser and device with WebGPU support.*
