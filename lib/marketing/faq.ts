/*
  Landing-page FAQ. Answers are checked against what the product
  actually does — pricing here has to match `lib/billing/plans.ts`, not
  drift from it, or the FAQ becomes the thing this whole codebase's
  commit history keeps calling out: a claim nothing behind it backs up.
*/
export const FAQ: { question: string; answer: string }[] = [
  {
    question: "What is MIDO XI, actually?",
    answer:
      "A private football intelligence environment. One system for matches, film, training, development and study, linked together in a single loop — rather than a match app, a video app and a training log that don't talk to each other.",
  },
  {
    question: "Do I need a wearable to use it?",
    answer:
      "No. Recovery is self-reported by default — four scores you enter yourself. Connect a WHOOP strap and real HRV, resting heart rate and sleep data appear alongside it, clearly separated from what you typed in. Nothing is estimated to fill the gap if you don't.",
  },
  {
    question: "Is there a free tier?",
    answer:
      "Yes — Player, Coach and Trainer OS each have a genuinely useful free version. Paid plans start with Player at $9.99/month for deeper AI-assisted analysis, up through Touchline at $29/month for coaches and trainers working with a squad, and Club at $149/month for organisations.",
  },
  {
    question: "Can my coach and I use it together?",
    answer:
      "That's most of the point. A coach connects to a player once, and from there can leave feedback, share sessions with a live agenda, and propose training times that need your answer before anything moves on your calendar.",
  },
  {
    question: "What happens to my data if I stop paying?",
    answer:
      "Nothing is deleted for lapsing on a plan. You drop back to the free tier's access; your matches, film, notes and history stay exactly where they were.",
  },
  {
    question: "Is my film private?",
    answer:
      "By default, yes — visible only to you and any coach you've explicitly connected with. Sharing to the community feed is opt-in per post, never automatic.",
  },
];
