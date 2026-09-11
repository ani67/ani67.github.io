---
title: "Interplanetary Racers | Racing in parametric worlds"
date: "2026-09-10"
description: "A free browser racing game for playing with friends. Bringing together my tool-building practice, imaginary planets and procedurally generated worlds."
tags: ["art"]
image: "https://res.cloudinary.com/duw0custw/image/upload/v1788848985/Screenshot_2026-09-08_at_11.57.02_AM_gmgnhx.png"
published: false
---

I made a game. It's called [Interplanetary Racers](/interplanetary-racers/), and you can play it in your browser for free. Pick a spacecraft, pick a planet, and race through a generated world. Play with bots, or open a room and get your friends in.

You can keep racing the same course and learn its turns, or change the seed, the text that the game uses to generate its world, and get a different one. I wanted that choice to be part of playing: get familiar with a place, or see what else turns up.

![The title screen of Interplanetary Racers, set against the pale landscape and turquoise gates of Halcyon.](https://res.cloudinary.com/duw0custw/image/upload/v1788848985/Screenshot_2026-09-08_at_11.57.02_AM_gmgnhx.png "Interplanetary Racers. A little world in a browser tab.")

## Why a game?

I wanted to make something I could play with my friends. Spacecraft, alien planets, a race through a strange landscape. The sort of thing I'd enjoy spending time inside, and could send to someone else.

Making it free and putting it in a browser were part of that intention. I didn't want trying this little experiment to mean buying a game or owning a particular console. You open the page, see if it's your thing, and maybe invite a friend.

And there was the pleasure of making it myself. I've spent years generating shapes and environments. Giving those experiments controls, a course to follow and other people to race with felt like something worth exploring.

## Somewhere I've wanted to go

Oban Star-Racers and Star Wars are references here. What draws me to them is the spacecraft, the planets, the possibility of moving through a world that has very little to do with the one outside your window. Racing gives you a reason to get close to that landscape, to move through it and react to it.

I wanted a little bit of that feeling in something I could make and share.

And looking back, I've been making versions of these things for a while now. Parametric shapes, alien spaceships, procedural landscapes. A lot of my generative art practise has involved building systems and seeing what kinds of worlds come out of them.

![An earlier generative art exploration using parametric surfaces, noise and point clouds.](https://res.cloudinary.com/duw0custw/image/upload/parametric-geometry-94_zfsfp6.jpg "An earlier exploration of parametric geometry. I shared this in Hello World.")

After the Terraforming programme, generative art became one way of figuring out what I wanted to make. I've written a little about that in [Hello World](/posts/hello-world/). Make something, play with it, learn some random shit, see where it goes.

An interest in planetarity came out of that period too: thinking about a planet through the relationships between its environments, systems and inhabitants. In this game, a small part of that interest becomes something you can feel through the controls. The terrain and conditions of a place affect how you move through it.

Here it becomes a fairly literal question: what kind of world is this, and what does it feel like to move through it?

## My practise is building tools

My practise is mostly [building tools](/posts/tool-making-as-an-art-practice/). I like making something I can keep experimenting with. Change a value, get a different shape, find something I wouldn't have drawn by hand. With generative art, a lot of the work happens in deciding what can vary and what needs to hold together.

This game comes from the same place.

I'm building a system that makes spacecraft and worlds, and gives people something to do inside them. The racing brings a purpose to all that geometry. You choose a craft. You try to make a turn. You miss a gate. The shape of the world starts to matter in a different way when you're trying to get through it.

With friends in the same race, those generated shapes become a shared course. Everyone has to deal with the same turns and obstacles. That's what I wanted to add to these experiments: the possibility of playing inside them together.

## How the worlds happen

Each planet starts with a set of rules. Terrain, colours, fog, the kinds of shapes that appear, and the way movement behaves. The seed picks values within those rules and the geometry gets built from them.

That gives a planet a character while leaving room for different versions of it. Canyon landscapes, drowned cities, crystal circuits, asteroid lanes. The environment also changes things like drag, grip and gravity, so the differences reach into how you steer and move.

![The planet selection screen in Interplanetary Racers.](https://res.cloudinary.com/duw0custw/image/upload/v1788848986/Screenshot_2026-09-08_at_11.57.19_AM_przw6o.png "Choosing a planet. Each one defines a different set of possibilities for the generator.")

The tracks are procedural too. Curves and parameters define the route, and the world is generated around it. A different seed changes that configuration. New tracks, new worlds, without having to build each one by hand.

The spacecraft follow a similar idea. Hulls, wings, engines, fins, smaller details, assembled through recipes with room for variation. A few changes in proportion can give a ship a completely different character. This is the parametric stuff I've always enjoyed playing with, now attached to something you can actually fly.

![The craft selection screen in Interplanetary Racers.](https://res.cloudinary.com/duw0custw/image/upload/v1788848984/Screenshot_2026-09-08_at_11.57.10_AM_vuj9qv.png "Choosing a craft. Shapes, proportions and parts assembled into something playable.")

A seed also means you can return to the same place. Keep the planet and seed, and you get the same generated world again. In multiplayer, each browser uses that shared starting point to build the same environment. So you can have another go at a course together, or change it when you want something unfamiliar.

I like that a string of characters can become somewhere we meet.

## Still figuring it out

Generating a world gives you something to explore. Making it enjoyable to race through asks more of the system. You need to see where you're going, understand how the craft responds, and have a reason to try again. There's a lot in that relationship between the landscape, the camera and the controls.

![An in-race view of a spacecraft flying through the gates on Halcyon.](https://res.cloudinary.com/duw0custw/image/upload/v1788848984/Screenshot_2026-09-08_at_11.57.34_AM_gjtyuf.png "Inside the race. The geometry becomes something to navigate.")

It's still an experiment. I'm interested in whether the generated worlds make you curious enough to try another one, and whether the racing makes you want to return to a world you've already seen. Those are things I'd like to hear from people who play it.

If you want to try it, [open Interplanetary Racers](/interplanetary-racers/). Pick a craft and planet, then play solo with bots or open a multiplayer room and share the room code with a friend. You'll need a browser and device with WebGPU support; a keyboard is best for the controls.

Let me know what you find. Especially where it gets weird.
