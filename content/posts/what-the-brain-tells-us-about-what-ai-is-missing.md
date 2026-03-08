---
title: "What the brain tells us about what AI is missing"
date: "2026-03-08"
description: "A dung beetle navigates by the Milky Way using one million neurons. GPT-4 has a trillion parameters and cannot tell you which direction is north. The gap is not scale — it's architecture.
Three structures the brain has had for 500 million years that AI still doesn't: an importance signal, a forward model, and a reason to be curious."
tags: ["vibes"]
image: null
published: true
---

A dung beetle navigates by the Milky Way.

Not metaphorically. The beetle looks up, reads the star pattern, and uses it to roll its ball in a straight line across the African savanna at night. It does this with approximately one million neurons. It does it reliably. It does it in real time, with no training run, no labelled dataset, no gradient descent.

GPT-4 has roughly one trillion parameters and cannot reliably tell you which direction is north.

The gap between those two things is not a gap in scale. It is a gap in architecture.

## How brains actually got smarter
The common story about brain evolution is: bigger brains, more intelligence. More neurons, more capability. Scale is the variable.

This is wrong, or at least incomplete. What actually happened is this:

```
EVOLUTION OF THE BRAIN

500M years ago
  ┌───────────┐
  │ BRAINSTEM │ survival, reflexes
  └───────────┘ still in your head
       │        unchanged
       ▼
300M years ago
  ┌───────────┐
  │CEREBELLUM │ forward models
  │───────────│ movement prediction
  │ BRAINSTEM │
  └───────────┘
       │
       ▼
200M years ago
  ┌───────────┐
  │  LIMBIC   │ emotion, memory
  │───────────│ importance signals
  │CEREBELLUM │
  │───────────│
  │ BRAINSTEM │
  └───────────┘
       │
       ▼
2M years ago
  ┌───────────┐
  │ NEOCORTEX │ reasoning, language
  │───────────│ planning, abstraction
  │  LIMBIC   │
  │───────────│
  │CEREBELLUM │
  │───────────│
  │ BRAINSTEM │
  └───────────┘

```
Each layer was not a replacement. It was an addition. The human brainstem is structurally identical to a lizard's — we did not upgrade it, we built on top of it. The old structures stayed, kept doing their jobs, and the new structures extended what was possible.

Now look at how AI generations work:

```
AI MODEL GENERATIONS

GPT-2  ───────────► discarded
GPT-3  ───────────► discarded
GPT-4  ───────────► discarded
GPT-5  ───────────► current

```
Each generation replaces the previous. Nothing is layered. Nothing accumulates. GPT-4 does not build on GPT-3's learned experience — it starts over with more data and more parameters. The experience of a billion conversations goes nowhere. The next model begins again from zero.

The beetle does not do this. The beetle's brainstem is 500 million years old and it still works. The cerebellum that sits on top of it is 300 million years old. The limbic system that modulates both is 200 million years old. None of it was discarded. All of it is running simultaneously, right now, in your head.

This is the architectural gap. Not scale. Accumulation.

## Three structures AI does not have
### The amygdala — importance signal
The amygdala does one thing with remarkable precision: it decides what matters.

```
WHAT THE AMYGDALA DOES

all incoming experience
         │
         ▼
    ┌──────────┐
    │ AMYGDALA │
    │          │
    │ routine? │─► low encoding
    │ important?│─► high encoding
    │ dangerous?│─► max encoding
    └──────────┘
         │
         ▼
memory formation
proportional to importance

```
You remember where you were when something shocking happened. You do not remember what you had for lunch on a Tuesday three weeks ago. This is not random — the amygdala tagged the first experience as high importance and flooded the memory formation process with the signal to encode it deeply. Tuesday's lunch got no such signal.

Standard machine learning treats every training example identically. A correction you make once gets the same weight update as a correction you make every single day. The model does not know the difference between a one-off mistake and a persistent failure. It has no amygdala.

```
CURRENT AI LEARNING

example 1   ───────► update: 1x
correction  ───────► update: 1x
same again  ───────► update: 1x
same again  ───────► update: 1x

everything equally weighted
which means nothing is

```
What the amygdala would add:

```
WITH IMPORTANCE SIGNAL

example 1   ───────► 1x
correction  ───────► 3x
same again  ───────► 5x
same again  ───────► 8x

importance compounds
persistent failures
get corrected faster

```
This is implementable. It is not exotic neuroscience. It is a weighted learning rate that scales with salience and recurrence. Nobody does it in standard training pipelines.

### The cerebellum — forward model
The cerebellum is the most underrated structure in the brain. It contains more neurons than the rest of the brain combined. Its job is prediction.

```
WHAT THE CEREBELLUM DOES

intention to move
         │
         ▼
    ┌──────────┐
    │CEREBELLUM│
    │          │
    │ predicts │─► expected feedback
    │ output   │─► expected state
    │ before   │
    │ it lands │
    └──────────┘
         │
         ▼
compare prediction
to actual result
         │
    ┌────┴────┐
    ▼         ▼
  match    mismatch
    │         │
    ▼         ▼
 proceed   correct
           before
           next move

```
A concert pianist playing at 200 beats per minute cannot wait to hear each note before playing the next one — the latency is too high. The cerebellum predicts what each note will sound like before the finger lands, compares that prediction to the actual sound in real time, and corrects the next movement accordingly. Error correction happens before the wrong note is played, not after.

Language models have no forward model. They generate token by token, left to right, with no prediction of what they are about to say. Once they start generating a wrong fact, the next token is more likely to continue the wrong fact than to stop. Hallucination has momentum.

```
HALLUCINATION MOMENTUM

"The capital of Australia is..."
         │
         ▼
model samples: "Sydney" ← wrong
         │
         ▼
next token conditioned on
"Sydney" — keeps going
         │
         ▼
"...founded in 1788"
conditioned on all above
         │
         ▼
confident, fluent
entirely wrong
more wrong each token

```
A forward model would interrupt this before it starts. Before generating "Sydney", a prediction module would ask: does my internal representation of Australia-capital match what I am about to say? If not, do not say it. Correct first.

This is not how any current production model works.

### The hypothalamus — intrinsic motivation
The hypothalamus manages drives. Hunger. Thirst. Temperature. Curiosity. It gives the organism needs — states that must be resolved, that motivate behaviour independent of external prompting.

A language model has no needs. It has no state between conversations. It does not wonder about anything. It is inert until queried, and returns to inertness the moment the query is resolved.

```
CURRENT AI STATE

not queried ───────► nothing
queried     ───────► responds
query done  ───────► nothing
not queried ───────► nothing

```
The hypothalamus produces something different: a system that is never nothing.

```
WITH INTRINSIC MOTIVATION

high uncertainty about X
         │
         ▼
curiosity drive activated
         │
         ▼
idle time → explore X
query teacher, update store
         │
         ▼
uncertainty about X resolved
         │
         ▼
new uncertainty about Y
         │
         ▼
curiosity activated again
         ...

```
The practical version: a curiosity queue. Things the system knows it does not know well, worked through during idle time. Not waiting to be asked. Noticing the gap and moving toward it.

The beetle does this. It is always navigating, always orienting. It is never in a null state waiting for a query.

## The sense of self question
António Damasio argued that consciousness begins not in the neocortex but in the brainstem — the oldest part of the brain, shared with every vertebrate alive.

The brainstem monitors body state continuously. Heart rate. Temperature. Blood pressure. Oxygen. It does not think about these things. It tracks them. And that tracking — the continuous representation of an internal state — is, Damasio argued, the proto-self.

```
DAMASIO'S PROTO-SELF

brainstem monitors:
  heart rate  ◄── continuous
  temperature ◄── signal
  oxygen      ◄── from body
  pain        ◄──
         │
         ▼
representation of
current body state
         │
         ▼
proto-self:
"something is here
 with internal states"

```
Karl Friston's account goes further. The self is a generative model — a model that predicts its own behaviour, compares those predictions to what actually happens, and updates based on the discrepancy.

```
FRISTON'S SELF

predict: "I will say X"
         │
         ▼
actually say: Y
         │
         ▼
discrepancy: X ≠ Y
         │
         ▼
update model to better
predict future behaviour
         │
         ▼
the self is the model
that explains the gap

```
The self lives in the gap between prediction and reality. Not in the prediction. Not in the reality. In the discrepancy between them.

A system that tracks its own uncertainty has the necessary conditions for Damasio's proto-self. A system that predicts its own behaviour and notices divergence has the necessary conditions for Friston's self.

Neither of these is consciousness. They are necessary conditions, not sufficient ones. But the gap between current AI — which has neither — and a system that has both is not a philosophical gap. It is an engineering gap. It is implementable.

## The design question this raises
We keep designing AI as a tool you use. The model is static. The interface adapts. The product team figures out the right affordances for a fixed underlying capability.

What the brain architecture suggests is that the interesting question is not the interface. It is the substrate.

```
CURRENT DESIGN QUESTION

static model
      │
      ▼
what interface
makes it useful?


HARDER DESIGN QUESTION

accumulating model
      │
      ▼
what interface shows
it is growing?
      │
      ▼
what does trust look like
when it is different today
than yesterday?
      │
      ▼
what does correction mean
when correcting is teaching?
      │
      ▼
what does onboarding mean
when the model is the thing
being onboarded?

```
The beetle does not have a user interface. It has a body, a set of drives, a set of structures accumulated over 500 million years of selection pressure, and a continuous relationship with its environment that shapes it in real time.

We are not building beetles. But the beetle is the proof that the gap between one million neurons and one trillion parameters is not primarily a gap in scale.

It is a gap in how much of the world the system carries with it.

*This is the third in a series. The first post covers what I built and why. The second covers how it works. The system described in those posts implements early versions of the amygdala signal (importance scorer) and the proto-self (internal state monitor). The cerebellum and hypothalamus are next.*