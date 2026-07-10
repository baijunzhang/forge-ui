# Subject: Weekly Update – Desk Learnings, Product Progress & AI Markets Opportunities

Hi [Manager's Name],

Hope you're well. Below is a summary of this week's progress: desk shadowing across MSS, improvements to AI Markets Desktop, and continued work on the Wealth Sales automation project.

## 1. Desk Conversations & AI Markets Opportunities

I spoke with 11 desks this week. Key learnings and potential AI Markets use cases:

| Desk | Key Learning | Potential AI Markets Opportunity |
|---|---|---|
| **Wealth Sales** | Structured products (FCNs, autocallables, airbags); FinIQ already provides digital pricing access | Not replacing pricing platforms, but layering on top: translate natural-language client requests into pricing parameters, flag missing info, compare terms, generate client-facing explanations |
| **Wealth Retail** | MSS → WPB → retail distribution chain; tokenisation could fractionalise bonds with large minimum denominations | End-to-end workflow design — regulation, custody, settlement and suitability matter as much as the interface |
| **G10 Rates Trading** | Interaction of market making, macro views, client flows and risk; desk seeking IT integration and capital efficiency | Client-flow analysis from eRisk data, scenario tools, converting trader experience into systematic decision support |
| **Corporate Sales** | FX forwards/swaps/CCS tied to clients' real commercial activity; value comes from combining Markets pricing with balance sheet, payments and trade finance | Extract RFQ details from Bloomberg enquiries → route to trader → return price to Sales; requires reliable data quality and entity mapping first |
| **FX Structuring** | Converting client views/objectives into defined payoffs and term sheets | Read Sales inputs across formats (email, Bloomberg chat, screenshots, files), extract view/pair/tenor/constraints, flag gaps, output standardised Excel/blotter request |
| **Prime Sales** | Full prime-services offering; quant vs. long-short clients need very different service models; wallet share across PBs matters | Client-activity dashboards, onboarding status tracking, product usage and relationship intelligence |
| **Flow Credit Trading** | P&L driven by bid-offer, inventory holding period, spread moves; IG/HY/distressed; DV01 and duration | Aggregate RFQs, axes and inventory; analyse client preferences; separate Treasury moves from credit-spread changes |
| **eTrading & Cash Equities Execution** | High-touch / low-touch / programme / algo execution; clients assess stability, algo performance vs. benchmarks (VWAP), connectivity, post-trade analytics | Recommend execution method by client objective, detect abnormal execution, generate clearer slippage/benchmark explanations |
| **Global FX Services** | FX overlay, custody FX, transaction FX, algo execution; value is workflow efficiency and lower operational risk, not just price | Read portfolio/transaction files → identify exposures → calculate hedges → detect exceptions → generate client reports |
| **Equity Derivatives** | Practical pricing depends on funding, borrow costs, flows, concentration and trader judgement — not just the model | Assess AI solutions by useful output and adoption, not technical sophistication |

## 2. Building Trust Through Follow-Up

After collecting desk feedback, I verified requests with Sarang and learned several capabilities were already in development, including a recently released API integration. I followed up with the FX Options desk, which had originally raised the request — she appreciated that we remembered and came back with a concrete update. Takeaway: trust is built by closing the loop, not just collecting feedback. Even when a feature can't be delivered immediately, a transparent update strengthens engagement.

## 3. Team Project Progress

| Project | This Week's Progress | Key Learning | Next Week |
|---|---|---|---|
| **AI Markets Desktop** | Shipped several improvements and optimisations; tested the product from a user's perspective as part of my own daily workflow | User-perspective testing surfaced usability issues and improvement ideas that never appeared in the original functional requirements — testing is not just final QC, but a way to find where friction blocks adoption | Continue improvement and user-perspective testing |
| **Wealth Sales Automation (prompt engineering)** | Iterated on extraction prompts with Sarang: defined which fields to extract, output format, exclusions, and handling of missing/ambiguous information | Broad instructions aren't enough — the model needs concrete, representative examples covering realistic input variation; prompt design is an iterative process (test → diagnose → refine) grounded in business understanding of the workflow | Refine prompts with more representative examples covering different templates, product types and user styles |
| **User feedback & follow-up** | Verified desk requests with Sarang (several already in development, one API integration released); closed the loop with the FX Options desk on their earlier request | Trust is built by remembering feedback and returning with concrete updates — even when a feature can't be delivered immediately, a transparent update strengthens engagement | Continue following up with users on feedback and development progress |

## 4. Overall Takeaways & Next Steps

A recurring theme across the desk conversations is that information is fragmented across Bloomberg chats, emails, screenshots, Excel files and internal systems. In most cases the data, pricing tools and execution infrastructure already exist — the gap lies in the manual steps around them. This suggests the strongest opportunity for AI Markets is to connect existing tools and workflows rather than build another standalone platform. At the same time, the right solution differs by desk: Wealth teams value product discovery and explanation, trading desks care about pricing, flow and risk, execution teams focus on performance analytics, and Sales prioritises turnaround time and ease of use. My broader takeaway is that the most valuable AI solution may not be the one that automates the most complex decision, but the one that removes a repeated friction point, fits naturally into an existing workflow and produces output users can easily verify — which means trust, data quality and human review need to be designed in from the start.

Building on this, my priority for next week is to narrow the broader project into one clearly defined workflow with a specific user, a measurable pain point and a realistic MVP — including mapping the current and proposed processes, identifying the required systems and APIs, and clarifying where human review and approval should remain.

Best,
Lisa
