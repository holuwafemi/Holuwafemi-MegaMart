/**
 * Add this to your existing functions/index.js, alongside your refund function
 * and approveSeller. Requires the PAYSTACK_SECRET_KEY to already be set up in
 * your Secrets Manager the same way your refund function uses it.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch"); // npm install node-fetch@2 if not already present

/**
 * Callable function: verifyPayment
 * Called from checkout.html right after the Paystack popup's callback fires.
 *
 * This is the step that actually matters for security: the client-side
 * callback alone is NOT proof of payment — anyone can open devtools and
 * call that callback manually without paying. This function re-checks the
 * transaction directly with Paystack using your SECRET key (server-side only),
 * and only marks the order "paid" if Paystack itself confirms it.
 *
 * Data in: { reference: string, orderId: string }
 */
exports.verifyPayment = functions
  .runWith({ secrets: ["PAYSTACK_SECRET_KEY"] })
  .https.onCall(async (data, context) => {

    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }

    const { reference, orderId } = data;
    if (!reference || !orderId) {
      throw new functions.https.HttpsError("invalid-argument", "Missing reference or orderId.");
    }

    const orderRef = admin.firestore().collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Order not found.");
    }
    const order = orderSnap.data();

    // Make sure this order actually belongs to the person calling this function.
    if (order.userId && order.userId !== context.auth.uid) {
      throw new functions.https.HttpsError("permission-denied", "This order does not belong to you.");
    }

    // Ask Paystack directly whether this reference was really paid.
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    });
    const verifyJson = await verifyRes.json();

    if (!verifyJson.status || verifyJson.data.status !== "success") {
      await orderRef.update({ status: "payment_failed", paystackRef: reference });
      throw new functions.https.HttpsError("aborted", "Payment could not be verified.");
    }

    // Confirm the amount actually paid matches what the order expects
    // (in kobo) — stops someone paying ₦100 and claiming a ₦371,500 order.
    const paidKobo = verifyJson.data.amount;
    const expectedKobo = Math.round(order.total * 100);
    if (paidKobo < expectedKobo) {
      await orderRef.update({ status: "payment_mismatch", paystackRef: reference, paidKobo });
      throw new functions.https.HttpsError("aborted", "Paid amount does not match order total.");
    }

    await orderRef.update({
      status: "paid",
      paystackRef: reference,
      paidAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  });
