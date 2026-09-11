/**
 * Add this to your existing functions/index.js (alongside your refund function).
 * Requires firebase-admin and firebase-functions already initialized in that file.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * Callable function: approveSeller
 * Call this from your ADMIN DASHBOARD ONLY (not from the public site) once
 * you've vetted someone through the WhatsApp chat flow.
 *
 * It does two things:
 *  1. Creates/updates their /sellers/{uid} doc with status: "approved"
 *  2. Nothing else — deliberately does NOT grant Firestore admin rights.
 *     A "seller" and an "admin" are different roles; sellers should never
 *     get the request.auth.token.admin == true claim used in firestore.rules.
 *
 * Data in: { sellerUid: string, businessName: string, category: string }
 */
exports.approveSeller = functions.https.onCall(async (data, context) => {
  // Only YOU (an admin account) can call this — this is the actual gate that
  // stops random people from approving themselves as sellers.
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only an admin can approve sellers."
    );
  }

  const { sellerUid, businessName, category } = data;
  if (!sellerUid || !businessName) {
    throw new functions.https.HttpsError("invalid-argument", "Missing sellerUid or businessName.");
  }

  await admin.firestore().collection("sellers").doc(sellerUid).set({
    status: "approved",
    businessName,
    category: category || null,
    approvedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true };
});

/**
 * One-time setup: how YOU become an admin (run this once, manually,
 * e.g. via a local script with the Firebase Admin SDK — not exposed as
 * a public callable function, since anyone could call it otherwise):
 *
 *   admin.auth().setCustomUserClaims(YOUR_UID, { admin: true });
 *
 * After that, your login token carries admin: true, which is what
 * firestore.rules checks for approving sellers / flagging flash sales.
 */
