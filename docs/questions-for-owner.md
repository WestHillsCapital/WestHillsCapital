# Questions for the Owner

This file captures unclear business rules, risky assumptions in the code, missing edge-case decisions, and places where the code and the intended workflow may not match. These need your answers before the system can be considered fully production-ready.

---

## Pricing and payment timing

**Q1. What is the exact cut-off time for wires?**
The recap email says "by close of business on the next business day." The code computes the next business day but does not enforce a specific hour. What does "close of business" mean in practice — 5 PM CT? 6 PM CT? If a wire arrives at 4:58 PM vs. 5:02 PM, who decides whether pricing is honored?

**Q2. When are spot prices re-quoted for a deal?**
The code locks prices the moment Joe clicks Execute. If Joe takes 10 minutes filling in the Deal Builder before clicking Execute, the prices shown in the UI are stale. Do you need the UI to warn Joe if spot prices are more than N minutes old before allowing execution?

**Q3. Does a $0 shipping deal ever happen?**
The code requires `total > 0` but does not validate `shipping > 0`. If Joe enters $0 shipping for a large physical delivery, the invoice will reflect $0 shipping. Is there a minimum shipping fee that should be enforced, or is $0 valid for certain deal types?

---

## Product catalog

**Q4. Are there additional products planned?**
The system currently supports three products: Gold American Eagle (1oz), Gold American Buffalo (1oz), and Silver American Eagle (1oz). Their Dillon Gage product codes are hardcoded. If you add a new coin or bar, both the code and the DG API call must be updated and redeployed. Should a more flexible catalog be built into the admin interface?

**Q5. Do you ever sell fractional coins or non-1oz products?**
The system treats qty as a whole number and maps each product ID to a fixed DG code. If you sell a 1/2 oz Gold Eagle, there is no product ID or DG code for it in the current system. What is the intended behavior?

---

## IRA deals

**Q6. Is the IRA deal type actually used in production today?**
The code stores IRA-specific fields (custodian, IRA type, account number) and shows them in the Deal Builder, but the execution path for IRA has not been validated. IRA transfers involve direction of investment letters, different funding timelines, and possible compliance requirements. What is the actual intended flow for an IRA deal — is it handled entirely off-system with the code only recording the outcome?

**Q7. Who handles the custodian relationship for IRA deals?**
The code captures the custodian name but does nothing with it programmatically. Does Joe contact the custodian manually? Is there a standard letter or form that needs to be generated? Where is the custodian authorization step in the workflow?

---

## FedEx Hold

**Q8. What if the client's closest FedEx staffed location is very far away?**
The system auto-searches for a staffed FedEx Office near the client's address. If the nearest location is 100 miles away, is that acceptable? Should there be a fallback to home delivery in that case?

**Q9. How long can metals sit at the FedEx location unclaimed?**
FedEx typically holds packages for 5 business days before returning them to the sender. Does WHC have a policy for clients who do not pick up in time? Should the system warn Joe if a delivered milestone is not confirmed within 5 days of the shipping notification?

**Q10. What happens if the client cannot pick up and needs the package re-routed?**
There is no workflow in the system for package re-routing or address changes after execution. This would require contacting Dillon Gage directly. Should there be an internal note or flag for "re-route requested"?

---

## Shipping timing

**Q11. Is 24 hours always the right delay before the shipping notification email?**
The code schedules the shipping notification email 24 hours after the tracking number is received. This is based on the assumption that FedEx tracking data takes 12–24 hours to appear. Is this always true for your shipments? Should the delay be configurable?

---

## ACH / Order Paid milestone

**Q12. Is the "Order Paid" milestone useful given there's no API endpoint?**
The Order Paid milestone records when Joe ACH-pays Dillon Gage, but there is no Fiztrade API endpoint for ACH — Joe must pay manually on the Fiztrade website and then click the button. Is this milestone being used in practice? If not, should it be hidden?

---

## Operations and Google Sheets

**Q13. What happens when a deal is cancelled?**
There is no "cancel" action in the system. If a wire does not arrive and the deal needs to be cancelled, what is the process? Should there be a "Cancel Deal" button that marks the deal as cancelled in PostgreSQL and updates the Sheets status? Right now, the status would remain "Cancel Eligible" indefinitely.

**Q14. Should the Operations tab show all deals or only active ones?**
Currently every executed deal gets a row in the Operations tab, and rows are never removed. Over time this tab will grow to include completed and cancelled deals alongside active ones. Should there be a view filter, a separate archive tab, or automatic archiving of delivered deals?

**Q15. Who manages the "Days to Fund / Days to Ship / Days to Complete" formulas in the Operations tab?**
The code leaves these columns blank and expects the operator to enter `=NETWORKDAYS()` formulas. Has this been set up? If the tab is ever recreated (e.g. if someone deletes it by accident), those formulas will be gone.

---

## Client experience

**Q16. Do clients ever contact WHC asking about their order status?**
The system sends automated status emails but there is no client-facing tracking portal. If clients call or email asking for status updates, is Joe manually checking the Deal Builder? Should there be a client-facing order status page?

**Q17. What is the preferred contact for delivery confirmation?**
The delivery confirmation email says the metals have arrived. Who actually confirms delivery — does the client call WHC? Send an email? Does Joe call the client? There is no inbound webhook or confirmation mechanism in the system. Joe manually clicks "Delivered" based on presumably some form of client confirmation.

---

## Code and workflow mismatches

**M1. The "Order Paid" status in Sheets may not reflect actual payment.**
The `order_paid_at` timestamp is set when Joe clicks a button, not when payment actually clears at DG. The Ops status "Order Paid" in Sheets is advisory only.

**M2. `payment_received_at` and `wire_received_at` are redundant.**
When Joe clicks "Wire Received," the code sets both `wire_received_at` and `payment_received_at` (via COALESCE). There is also a legacy `/payment` endpoint that sets only `payment_received_at`. This creates two overlapping signals with slightly different semantics. This is a known technical issue that should be cleaned up, but it does not cause incorrect behavior under normal operation.

**M3. Slot times in winter will be wrong.**
The scheduling code uses UTC-5 (CDT) as a fixed offset year-round. From early November through mid-March (Central Standard Time = UTC-6), all displayed slot times will be 1 hour later than intended. For example, a slot shown as "9:00 AM CT" will actually be scheduled at 10:00 AM local time. This needs to be fixed before the first winter operating season.

**M4. The wire confirmation email "resend" button exists, but the original send is not retried automatically.**
If the wire confirmation email fails, a yellow banner appears and Joe must manually click "Resend." There is no automatic retry. If Joe misses the banner, the client never receives the email. Should the scheduler check for this and retry automatically?

**M5. There is no way to update a deal after execution.**
Once a deal is executed, the only writable fields are the milestone timestamps and notes. If Joe entered the wrong shipping address or client email at execution, there is no correction path in the UI. Changes require a direct database update.

---

## Missing decisions

**D1. What is the Terms of Service that clients are confirming?**
The code stores `terms_version = "v1.0"` and `confirmation_method = "verbal_recorded_call"`. There is no actual Terms of Service document linked from the system. Where does the terms document live, and what does it say? When terms change, who updates the version number in the code?

**D2. How long should completed deal records be retained?**
The booking_attempts table auto-prunes after 90 days. No other table has retention rules. As deal volume grows, should older delivered deals be archived somewhere? Is there a compliance requirement to retain transaction records for a specific period?

**D3. What constitutes a "no-show" for a booked appointment?**
The system confirms appointments and sends a reminder email. There is no mechanism to mark an appointment as no-show, reschedule, or cancel it in the DB. The slot remains "confirmed" forever. Should there be an appointment management interface?
