---
title: "I built an AI that knows who I am"
date: "2026-03-08"
description: "A local AI that runs on your laptop, knows who you are, and gets better every time you use it — built in a weekend, costs nothing to run, and your data never leaves your machine. The model thought I ran an interior design firm in Mumbai. Six sentences later it knew exactly what I do. Here's what I built and why it doesn't exist anywhere else."
tags: ["vibes"]
image: null
published: true
---

# I built an AI that knows who I am
Ask any local AI model what you do for a living.

Here is what a capable 3 billion parameter model told me about myself:

```
Q: What is Dashtoon Studio?
A: "Interior design firm in Mumbai"

Q: What is Frameo AI?
A: "Platform for analyzing data sets"

Q: What do I work on?
A: "I manage a team of developers"

```
I design AI products. I have spent three years building generative media platforms — a comic creation tool, a short drama generator. The model invented plausible-sounding replacements and delivered them with complete confidence.

This is not a bug. It is the design.

## The problem nobody has solved locally
Every local model starts from zero with every conversation.

```
CLOUD AI:
  remembers you
  on their servers
  your data is theirs

LOCAL AI:
  fast, private, free
  forgets on restart
  stranger every time

```
The cloud models have started to solve memory — but the memory belongs to them. I wanted something different. A model on my machine that knows who I am, without any of that leaving my laptop.

I did not know if it was possible. I spent a few weeks finding out.

## Four problems. Four solutions.
**Problem 1: models freeze after training.**

Standard language models learn during training, then stop. The weights — billions of numerical values encoding everything the model knows — are fixed at deployment. Talking to it is like talking to a photograph.

The solution: a thin layer of trainable parameters on top of the frozen model. Clay over a fixed sculpture. The sculpture never changes. The clay shapes to you.

In practice: 112 trainable parameters sitting on top of 3 billion frozen ones. That fraction of a fraction is enough.

**Problem 2: training and serving can't happen simultaneously.**

Standard training requires pausing everything — collect data, stop, train, restart. I wanted the opposite.

```
BUFFER A
  serves your queries
  always live
  never interrupted

BUFFER B
  absorbs your corrections
  trains in background
  swaps with A every 100 steps

```
The version you are talking to is always current. You never wait for it to learn.

*(The M1's unified memory makes this possible — no separate GPU memory, no transfer bottleneck. An Apple Silicon advantage nobody talks about.)*

**Problem 3: facts don't belong in weights.**

Language models hallucinate specifics because they try to store everything diffusely across billions of numbers. Asking a model to remember that Frameo AI is a video platform is like asking someone to memorise it by dreaming about it.

```
WEIGHTS:
  reasoning patterns
  how to think
  never hallucinated

KNOWLEDGE STORE:
  specific facts
  exact retrieval
  never approximated

```
Six statements taught the model who I am. Not six training runs. Six sentences, stored as facts, retrieved precisely when relevant.

**Problem 4: knowing when to ask for help.**

When the model is uncertain, it queries a local teacher — a smaller faster model running separately — gets a step-by-step reasoning trace back, and uses that as training data.

```
model uncertain about X
        │
        ▼
ask teacher model
        │
        ▼
teacher returns:
  REASONING: [steps]
  ANSWER: [conclusion]
        │
        ▼
trace → training queue
model improves
you never see this

```
The student learns from the teacher in the background. Neither interrupts the conversation.

## What happened after six sentences
```
BEFORE:

  Q: What is Dashtoon Studio?
  A: "Interior design firm"

  Q: What is Frameo AI?
  A: "Data analytics platform"

  Q: Who am I?
  A: "Software dev manager"


AFTER six teaching statements:

  Q: What is Dashtoon Studio?
  A: "AI comic platform,
      Figma-like canvas"

  Q: What is Frameo AI?
  A: "Generative video platform,
      chat-first, 0 to 1"

  Q: Who am I?
  A: "Ani Dalal, product designer
      and generative artist"

```
I closed the system. Restarted it. Asked again.

It remembered.

No cloud. No subscription. No data leaving the machine.

## What it notices on its own
What surprised me most was not what worked. It was what the system noticed without being asked.

It tracks four states continuously:

```
UNCERTAINTY
  how confident am I right now?

PERFORMANCE
  how often corrected recently?

NOVELTY
  how unfamiliar is this?

COHERENCE
  are recent answers consistent?

```
These are not displayed to me. They modulate behaviour internally. When uncertainty crosses a threshold, it reaches out to the teacher without being asked. When it has been corrected repeatedly on the same question type, it weights that correction more heavily.

After one session it reported:

*"I have processed 10 interactions. My current uncertainty is 50%. My recent performance is 100%. I am in somewhat unfamiliar territory."*

Which is accurate. It is learning a new domain. It does not know it well yet. It knows that it does not know it well.

## What this is not
A 3 billion parameter model running locally will not match GPT-4 on benchmarks. That is not the point.

The point is that after four weeks of daily use, this model will know my work, my vocabulary, my preferences, the products I build, the corrections I make repeatedly — at a depth no general model ever will.

General models are optimised for everyone. Which means they are perfect for no one.

**The individual is the gap that scale cannot close.**

## The design question on the other side
We have spent years building AI interfaces — chat windows, suggestions, autocomplete — as if the model is static and the interface is the only thing that adapts. The model is the given. The design is the variable.

What happens when the model is also the variable?

When the thing underneath is accumulating, specialising, becoming more yours with every interaction — the questions change entirely.

```
NOT: "how do I present this?"
BUT: "how do I show it is growing?"

NOT: "what should onboarding
      teach the user?"
BUT: "what should onboarding
      teach the model?"

```
I do not have answers yet. I have a working system, a file of wrong answers from day one, and four weeks of daily use ahead to find out whether the improvement is real, measurable, and worth designing around.

I will write what I find.