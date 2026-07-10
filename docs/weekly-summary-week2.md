# Weekly Update – Week 2 (condensed, table form)

**Subject: Weekly Update – Desk Learnings, Product Progress and AI Markets Opportunities**

Hi [Manager's Name],

Hope you are well. This week I focused on understanding desk workflows and product knowledge, translating desk feedback into AI Markets opportunities, and contributing to AI Markets Desktop and the Wealth Sales automation project. I spoke with 10 desks and joined a Wealth Sales client meeting with Futu.

## 1. Desk shadowing — key learnings and AI Markets opportunities

| Desk | Key learning | Potential AI Markets opportunity |
|------|--------------|----------------------------------|
| **Wealth Sales** | Structured products (FCN, autocallables, airbag); FinIQ gives clients digital pricing vs email enquiries | Turn NL client requests into pricing parameters, flag missing info, compare terms, produce clearer client explanations |
| **Wealth Retail** | MSS→WPB→retail distribution; tokenisation to fractionalise bonds for retail | End-to-end matters (regulation, custody, settlement, suitability), not just UI |
| **G10 Rates Trading** | Market making + macro views + client flow + risk; wants IT integration & capital efficiency; eRisk client data | Client-flow analysis, scenario tools, systematise knowledge embedded in voice trading |
| **Corporate Sales** | FX fwd/swap/CCS tied to corporate commercial activity + HSBC balance sheet | Extract RFQ from Bloomberg, route to trader, return price; needs data quality & entity mapping |
| **FX Structuring** | Converts client view → product params/payoff/term sheet; Sales→Structuring handoff is manual | Read email/chat/screenshot, extract view/pair/tenor/objective, flag missing fields, output standardised Excel |
| **Prime Sales** | Prime services (swaps, Delta One, financing, SBL, market access, onboarding); client models differ | Client-activity dashboards, onboarding status, product usage, relationship intelligence |
| **Flow Credit Trading** | Issuer fundamentals, RV, Treasury moves, liquidity, client flow; IG/HY/distressed; duration/DV01 | Aggregate RFQs/axes/inventory, analyse client preferences, compare spreads, separate Treasury vs credit-spread moves |
| **Electronic Trading / Cash Equities Execution** | High/low-touch, programme, algo; VWAP benchmarks, connectivity, analytics; HK/SEA market structure | Recommend execution method, flag abnormal performance, explain slippage & benchmark results |
| **Global FX Services** | Connects portfolio exposures → hedge → execution → settlement → reporting; FX overlay, custody/transaction FX | Read portfolio/transaction files, identify exposures, calculate hedges, detect exceptions, generate client reports |
| **Equity Derivatives** | Autocallables + bespoke; pricing depends on funding, borrow, flow, concentration, hedging, judgement | Assess AI value by useful output + adoption, not just technical sophistication |

## 2. Building trust through follow-up
After collecting desk feedback, I checked with Sarang, learned several requested capabilities were already in development (one API recently released), and followed up with the FX Options desk that had raised it. This small loop-closing reinforced that trust is built through consistent follow-up — users share more when they see their feedback is remembered and acted on. Trustworthiness comes not only from the model output, but from how the team communicates and closes the loop.

## 3. AI Markets Desktop — user-centred testing
We made several improvements to AI Markets Desktop. Viewing it as a product I'd personally use made me more attentive to whether information is easy to find, layout/wording is intuitive, and outputs are immediately usable. Testing is not just final QC — it's a source of new product ideas and surfaces usability needs not in the original requirements.

## 4. Wealth Sales automation — prompt engineering
Continued with Sarang. Key learning: effective prompting needs concrete, representative examples — not just "extract the relevant information," but which fields, what format, what to exclude, and how to handle missing/ambiguous inputs, across realistic input variation. Prompt design is iterative and must be grounded in business understanding of the Wealth Sales workflow.

## 5. Overall takeaways & next steps
A recurring theme: information is fragmented across Bloomberg chats, emails, screenshots, Excel and internal systems — the data and tools often already exist, but the steps around them are manual. **The strongest opportunity may be connecting existing tools and workflows, not building another standalone platform.** The most valuable solution may not automate the most complex decision, but remove a repeated friction point, fit naturally into an existing workflow, and produce output users can easily verify — so trust, data quality, human review and adoption must be considered from the start.

**Next week:** continue improving/testing AI Markets Desktop; refine Wealth Sales prompts with more representative examples; follow up with users on feedback and product updates; and narrow the project into a defined workflow with a specific user, measurable pain point, and realistic MVP (mapping current/proposed process, required systems/APIs, and where human review should remain).

Best,
Lisa
