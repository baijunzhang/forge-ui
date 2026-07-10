# Subject: Weekly Update – Desk Learnings, Product Progress & AI Markets Opportunities

Hi [Manager's Name],

Hope you're well. Below is a summary of this week's progress: desk shadowing across MSS, improvements to AI Markets Desktop, and continued work on the Wealth Sales automation project.

## 1. Desk Conversations & AI Markets Opportunities

I spoke with colleagues across a number of desks this week. Key learnings and potential AI Markets use cases:

| Desk | Key Learning | Potential AI Markets Opportunity |
|---|---|---|
| **Wealth Retail** | MSS → WPB → retail distribution chain; tokenisation could fractionalise bonds with large minimum denominations | End-to-end workflow design — regulation, custody, settlement and suitability matter as much as the interface |
| **G10 Rates Trading** | Interaction of market making, macro views, client flows and risk; desk seeking IT integration and capital efficiency | Client-flow analysis from eRisk data, scenario tools, converting trader experience into systematic decision support |
| **Corporate Sales** | FX forwards/swaps/CCS tied to clients' real commercial activity; value comes from combining Markets pricing with balance sheet, payments and trade finance | Extract RFQ details from Bloomberg enquiries → route to trader → return price to Sales; requires reliable data quality and entity mapping first |
| **FX Structuring** | Converting client views/objectives into defined payoffs and term sheets | Read Sales inputs across formats (email, Bloomberg chat, screenshots, files), extract view/pair/tenor/constraints, flag gaps, output standardised Excel/blotter request |
| **Prime Sales** | Full prime-services offering; quant vs. long-short clients need very different service models; wallet share across PBs matters | Client-activity dashboards, onboarding status tracking, product usage and relationship intelligence |
| **eTrading & Cash Equities Execution** | High-touch / low-touch / programme / algo execution; clients assess stability, algo performance vs. benchmarks (VWAP), connectivity, post-trade analytics | Recommend execution method by client objective, detect abnormal execution, generate clearer slippage/benchmark explanations |
| **Global FX Services** | FX overlay, custody FX, transaction FX, algo execution; value is workflow efficiency and lower operational risk, not just price | Read portfolio/transaction files → identify exposures → calculate hedges → detect exceptions → generate client reports |
| **Equity Derivatives** | Practical pricing depends on funding, borrow costs, flows, concentration and trader judgement — not just the model | Assess AI solutions by useful output and adoption, not technical sophistication |

## 2. Building Trust Through Follow-Up

Something you mentioned last week stayed with me — that asking users what they need is only half the job. I got to test this in practice: after collecting feedback from several desks, I checked the requests with Sarang and found that a few of them were already being built, and one API integration had just gone live. So I went back to the FX Options desk, who had raised the request in the first place, and told her. It was a small thing, but she clearly appreciated that we remembered and came back with an actual update. It made the point concrete for me: people keep sharing what they need when they see their feedback actually goes somewhere, even if the answer is "not yet, but here's where it stands."

## 3. Team Project Progress

| Project | This Week's Progress | Key Learning | Next Week |
|---|---|---|---|
| **AI Markets Desktop** | Shipped several improvements and optimisations; tested the product from a user's perspective as part of my own daily workflow | User-perspective testing surfaced usability issues and improvement ideas that never appeared in the original functional requirements — testing is not just final QC, but a way to find where friction blocks adoption | Continue improvement and user-perspective testing |
| **Wealth Sales Automation (prompt engineering)** | Iterated on extraction prompts with Sarang: defined which fields to extract, output format, exclusions, and handling of missing/ambiguous information | Broad instructions aren't enough — the model needs concrete, representative examples covering realistic input variation; prompt design is an iterative process (test → diagnose → refine) grounded in business understanding of the workflow | Refine prompts with more representative examples covering different templates, product types and user styles |

## 4. Overall Takeaways & Next Steps

If there was one theme that kept coming up in almost every desk conversation, it's fragmentation: the information people need sits scattered across Bloomberg chats, emails, screenshots, Excel files and internal systems. What surprised me is that the hard parts — the data, the pricing tools, the execution infrastructure — mostly already exist. It's the manual steps in between that eat everyone's time. So I've become more convinced that our best opportunity isn't building yet another platform, but stitching together what's already there. That said, "useful" means something different on every desk — Wealth wants help explaining and finding products, traders care about flow and risk, execution teams want performance analytics, and Sales just wants faster turnaround — so a one-size solution probably won't land.

The other thing this week changed my mind about: I used to assume the most impressive AI use case would be automating a complex decision. Now I think the winner is more likely something boring — a repeated friction point that we remove, in a way that fits how people already work and produces output they can verify at a glance. Which also means trust, data quality and human review can't be bolted on later.

With that in mind, my main goal for next week is to narrow all of this down to one concrete workflow: a specific user, a measurable pain point, and an MVP we can realistically build — including mapping the current vs. proposed process, the systems and APIs involved, and where human sign-off should stay.

Best,
Lisa
