import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { PURCHASE_CHANNELS, NON_IRA_DELIVERY, IRA_DELIVERY, SELF_SERVE_PRICE_LOCK } from "@/lib/purchase-policy";

export default function Terms() {
  usePageMeta({
    title: "Terms of Service | West Hills Capital",
    description: "Terms of Service for West Hills Capital. Review the terms governing use of our website and precious metals services.",
    canonical: "https://westhillscapital.com/terms",
  });

  return (
    <div className="w-full bg-background min-h-screen pt-16 pb-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">

        <h1 className="text-4xl font-serif font-semibold mb-4">Terms of Service</h1>
        <p className="text-sm text-foreground/50 mb-12">Applies to self-serve and representative-assisted purchases.</p>

        <div className="space-y-12 text-foreground/80 leading-relaxed">

          <section>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the West Hills Capital website (westhillscapital.com), calling our representatives, or engaging our services in any capacity, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use our website or services. These Terms apply to all visitors, clients, and prospective clients of West Hills Capital, LLC.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">2. Services Provided</h2>
            <p>
              West Hills Capital, LLC ("West Hills Capital," "we," "our," or "us") is a dealer in physical precious metals, including gold, silver, platinum, and palladium. Our services include facilitating the purchase and sale of physical precious metals for personal accounts and Individual Retirement Accounts (IRAs). We do not provide custody, storage, or transportation services directly; these functions are performed by third-party custodians, depositories, and carriers selected in connection with your transaction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">3. Not Investment Advice</h2>
            <p>
              West Hills Capital is not a registered investment advisor, broker-dealer, financial planner, tax professional, or attorney. Nothing communicated by our representatives — verbally, in writing, or through this website — constitutes investment advice, a solicitation to buy or sell, or a recommendation of any financial product. All information is provided for educational and informational purposes only. You are solely responsible for evaluating the merits and risks associated with any allocation decision, and we strongly encourage you to consult with qualified professionals before making any financial decision.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">4. Purchase Channels and Commitment</h2>
            <p>
              {PURCHASE_CHANNELS} For self-serve purchases, requesting a signing link is not a binding purchase; the purchase becomes binding when you sign the purchase agreement. Phone-assisted transactions are confirmed on a recorded telephone line by an authorized client or their designated representative and accepted by West Hills Capital. IRA purchases remain subject to custodial funding and execution requirements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">5. Eligibility</h2>
            <p>
              Our services are available to U.S. residents who are 18 years of age or older and have the legal capacity to enter into binding contracts. By using our website or engaging our services, you represent and warrant that you meet these eligibility requirements. We reserve the right to refuse service to any person at our sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">6. Pricing and Market Data</h2>
            <p>
              Spot price data and website product prices are indicative before commitment and can change with market conditions. {SELF_SERVE_PRICE_LOCK} For phone-assisted transactions, the confirmed price and terms are established with your representative. West Hills Capital is not responsible for errors in displayed pricing resulting from data provider outages or third-party feed delays.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">7. Market Risk and Volatility</h2>
            <p>
              Purchasing physical precious metals involves material financial risk. The value of gold, silver, and other metals fluctuates continuously based on global market conditions, supply and demand dynamics, geopolitical events, currency valuations, and other factors outside our control. Past performance is not indicative of future results. It is possible to lose money, including all or a portion of your principal investment. Precious metals should generally be considered long-term holdings, and no specific performance outcome is guaranteed or implied.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">8. Funding, Payment, and Settlement</h2>
            <p>
              For self-serve purchases, the agreement price is binding at signing and wire payment must be received by the end of the next business day. Shipment requires receipt of cleared funds; clearance does not reprice the signed order. Phone-assisted and IRA purchases follow their confirmed funding and execution terms, with IRA trades subject to custodian funds clearance. We do not extend credit or offer margin. Wire transfers must be sent in U.S. dollars to our designated banking institution.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">9. Trade Execution and Confirmation</h2>
            <p>
              Self-serve purchases become binding when the purchase agreement is signed. Phone-assisted purchases become binding upon confirmation on a recorded line and acceptance by West Hills Capital. A written confirmation, including quantity, product description, price, and total, will be provided to the client. West Hills Capital will use commercially reasonable efforts to execute confirmed transactions at the agreed price; however, in the event of a force majeure event, systems failure, or market suspension, execution may be delayed or modified, and West Hills Capital will promptly notify the client.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">10. Delivery and Shipping</h2>
            <p>
              {NON_IRA_DELIVERY} {IRA_DELIVERY} Physical shipments are insured. Estimated delivery windows are standard projections based on current wholesale availability; unforeseen supply chain disruptions, mint production delays, or carrier delays may extend delivery times. West Hills Capital is not liable for delays caused by third-party carriers, customs, or events outside our reasonable control. Title and risk of loss transfer to the client upon delivery to the carrier.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">11. Cancellation and Default</h2>
            <p>
              Because precious metals are volatile commodities and trade execution involves real-time market commitments, West Hills Capital does not accept cancellations or returns after a self-serve agreement is signed or a phone-assisted transaction is confirmed. For self-serve purchases, failure to fund by the agreement deadline may result in cancellation and a fee equal to the greater of $125 or the actual market loss, as stated in the purchase agreement. For other confirmed transactions, a client who fails to fund within the agreed timeframe is responsible for market loss incurred to liquidate or offset the position, plus applicable fees. West Hills Capital reserves the right to pursue all available legal remedies in the event of client default.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">12. Intellectual Property</h2>
            <p>
              All content on this website — including but not limited to text, graphics, logos, pricing tools, educational materials, and trade confirmations — is the exclusive property of West Hills Capital, LLC or its licensed content providers and is protected by applicable United States and international intellectual property laws. Unauthorized reproduction, distribution, modification, or use of any content is strictly prohibited. You may not use our name, logo, or branding without prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">13. Limitation of Liability</h2>
            <p className="mb-4">
              To the maximum extent permitted by applicable law, West Hills Capital, its members, officers, employees, and agents shall not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages arising out of or related to your use of our website, our services, or any transaction — including but not limited to lost profits, loss of data, or market losses — even if advised of the possibility of such damages.
            </p>
            <p>
              Our total aggregate liability for any claim arising out of or related to a specific transaction shall not exceed the total amount paid by you in connection with that transaction. Our total aggregate liability for any claim unrelated to a specific transaction shall not exceed one hundred U.S. dollars ($100.00).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">14. Governing Law and Jurisdiction</h2>
            <p className="mb-4">
              These Terms of Service shall be governed by and construed in accordance with the laws of the State of Kansas, without regard to its conflict of law provisions. Any dispute, claim, or controversy arising out of or related to these Terms or our services shall be resolved exclusively by binding arbitration in Wichita, Kansas, under the rules of the American Arbitration Association, except that either party may seek injunctive or other equitable relief in any court of competent jurisdiction.
            </p>
            <p>
              These Terms constitute the entire agreement between you and West Hills Capital with respect to the subject matter hereof and supersede all prior or contemporaneous communications. We reserve the right to update these Terms at any time; continued use of our services after such updates constitutes acceptance of the revised Terms. The current version will always be available at westhillscapital.com/terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">15. Required Mediation</h2>
            <p className="mb-4">
              Before either party initiates arbitration or any other formal legal proceeding, the parties agree to attempt to resolve any dispute, claim, or controversy through good-faith mediation. Either party may initiate mediation by providing written notice to the other party describing the nature of the dispute and the relief sought. The parties shall jointly select a neutral mediator within fifteen (15) calendar days of such notice. If the parties cannot agree on a mediator, a mediator shall be selected in accordance with the mediation rules of the American Arbitration Association.
            </p>
            <p>
              Mediation shall take place in Wichita, Kansas, or by video conference if agreed by both parties, and shall be completed within sixty (60) days of the initial written notice unless both parties agree in writing to extend this period. All mediation proceedings, statements, and materials shall be confidential and shall not be admissible in any subsequent arbitration or litigation. Each party shall bear its own costs and attorneys' fees in connection with mediation; mediator fees shall be shared equally. If mediation does not result in a resolution within the timeframe set forth herein, either party may then proceed to binding arbitration as described in Section 14 above.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">16. No Class Action</h2>
            <p className="mb-4">
              <strong>ALL DISPUTES MUST BE BROUGHT IN AN INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, CONSOLIDATED, PRIVATE ATTORNEY GENERAL, OR REPRESENTATIVE PROCEEDING.</strong>
            </p>
            <p className="mb-4">
              To the fullest extent permitted by applicable law, you waive any right to participate in a class action lawsuit or class-wide arbitration against West Hills Capital. The arbitrator shall have no authority to consolidate claims of multiple individuals or entities, conduct any class, collective, or representative proceeding, or award relief to any person or entity not a party to the individual arbitration. Any claim that all or part of this class action waiver is invalid, unenforceable, unconscionable, or inapplicable shall be determined solely by a court of competent jurisdiction and not by an arbitrator.
            </p>
            <p>
              If for any reason a claim proceeds in court rather than through arbitration, you and West Hills Capital each waive any right to a jury trial and agree that such claim shall be brought solely on an individual basis in a court of competent jurisdiction in Wichita, Kansas. Nothing in this section shall limit either party's right to seek individual injunctive or other equitable relief in a court of competent jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">17. All Rights Reserved</h2>
            <p className="mb-4">
              &copy; {new Date().getFullYear()} West Hills Capital, LLC. All rights reserved. All content, materials, text, graphics, logos, images, audio clips, digital downloads, data compilations, pricing tools, and software displayed on or accessible through this website are the exclusive property of West Hills Capital, LLC or its content licensors and are protected by United States copyright law, trademark law, trade dress, patent law, and other applicable domestic and international intellectual property laws and conventions.
            </p>
            <p>
              No content from this website may be copied, reproduced, republished, uploaded, posted, transmitted, modified, distributed, or used in any way — in whole or in part — without the express prior written permission of West Hills Capital, LLC. Requests for permission to use any content should be directed to{" "}
              <a href="mailto:info@westhillscapital.com" className="text-primary hover:underline">info@westhillscapital.com</a>.
              Unauthorized use of any content from this website may violate copyright laws, trademark laws, and other regulations and statutes, and may subject the violator to civil and criminal penalties.
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-foreground/10 text-sm text-foreground/50">
          <p>
            For questions about these Terms, contact us at{" "}
            <a href="mailto:info@westhillscapital.com" className="text-primary hover:underline">info@westhillscapital.com</a>
            {" "}or call <a href="tel:8008676768" className="text-primary hover:underline">(800) 867-6768</a>.
          </p>
          <p className="mt-3">
            See also our{" "}
            <Link href="/disclosures" className="text-primary hover:underline">Disclosures & Operating Policies</Link>.
          </p>
        </div>

      </div>
    </div>
  );
}
