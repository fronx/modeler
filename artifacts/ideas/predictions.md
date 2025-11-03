# Mental Models with Predictions

## Status quo

The current thought system represents mental content statically. It's not like code that can be run to see how it will behave. It's not a simulation.

## Desired state

Ideally, the mental models should add something to the conversation that would be harder to anticipate without the explicit modeling act. They should be active artifacts. Surprise and resolution should be measured against them (as a standard) and with them (as generators).

## Barrier: code execution

Originally, I wanted to create a DSL for expressing thoughts, precisely because it would be embedded in a turing machine and so could be used to build simulations of arbitrary complexity.

Then we discovered that Next.JS can't just load TypeScript files dynamically and run them, which shouldn't be too surprising, for security reasons. So we focused on the static representational aspect of graphs, which can just as well be expressed in JSON.


## Evaluating representation formats

### JSON

Pro:
- can be stored and edited in Postgres
- no immediate security risk associated with reading & writing it

Contra:
- verbose, ugly syntax
- I suspect it's harder to read for AIs as well, not just humans
- No obvious way to interpret it dynamically without writing an interpreter from scratch, which would be way more work than embedding a DSL in a flexible language.

### TypeScript

It's a totally fine language, has types, and the AIs are already familiar with it.
Can only safely be executed in a sandbox.

- [ ] Create TypeScript sandbox (in browser? or backend? whichever works)


## Prediction scenarios

### Conversation among AI + group of humans

For each participant
- What do they care about?
- Beliefs, assumptions
- Intentions, needs
- Skills, expertise
- Trustworthiness
- Influence in the group
- Divergent vs. convergent contributer

These attributes can be represented in various ways such as lists of strings and LLM embeddings, but what makes them active components of a predictive model are moments of surprise or confirmation.

Surprise:
- "I thought you were the expert, but apparently you've just been winging it the whole time"
- "Ah, you're urgently hungry, so we should decide quickly instead of researching the best restaurant on the planet"

Confirmation:
- "I knew that presenting it as a challenge would get Person X excited about it"
- "We should take a break and come back recharged" (and then noticing that the break indeed helped)

So there is a pragmatic context that brings the semantic tokens to life. Without being put to use in that way, they would just be static notes.


### Philosophical conversation

- Think through the implications of conceptual commitments
  - "How does this play out"
- Check logical consistency

### Physics

- Run a physical model and measure the outcome

### Math

- Claim -> constructive proof

