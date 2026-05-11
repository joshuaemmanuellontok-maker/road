import { db, collections, serverTimestamp } from "./src/firebase.js";

const dryRun = process.argv.includes("--dry-run");

function asMillis(value) {
  if (!value) {
    return 0;
  }
  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }
  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function newest(values) {
  return values.filter(Boolean).sort((a, b) => asMillis(b) - asMillis(a))[0] ?? null;
}

function oldest(values) {
  return values.filter(Boolean).sort((a, b) => asMillis(a) - asMillis(b))[0] ?? null;
}

function pruneUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(pruneUndefined);
  }

  if (!value || typeof value !== "object" || typeof value.toDate === "function") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, pruneUndefined(entry)]),
  );
}

function payoutStatusFromPayout(payout, payment) {
  const status = String(payout?.status ?? "").trim();
  if (status === "paid") {
    return "auto_transferred";
  }
  if (status === "details_required") {
    return "payout_details_required";
  }
  if (status) {
    return status;
  }
  return payment?.status === "completed" ? "processing" : "pending";
}

function paymentStatusFromPayment(payment) {
  if (!payment) {
    return null;
  }
  if (payment.status === "completed") {
    return payment.provider === "paymongo" ? "provider_paid" : "system_received";
  }
  if (payment.status === "pending_payment") {
    return payment.provider === "paymongo" ? "provider_pending" : "awaiting_motorist_payment";
  }
  return payment.status ?? null;
}

function dispatchStatusFromPayment(payment, payout, feedbacks) {
  if (payment?.status === "completed" || payout?.status === "paid" || feedbacks.length > 0) {
    return "completed";
  }
  if (payment?.status === "pending_payment") {
    return "payment_pending";
  }
  return "pending";
}

async function loadCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function groupByDispatch(docs) {
  const grouped = new Map();
  for (const doc of docs) {
    const dispatchId = doc.dispatch_id ?? doc.dispatchId;
    if (!dispatchId) {
      continue;
    }
    if (!grouped.has(dispatchId)) {
      grouped.set(dispatchId, []);
    }
    grouped.get(dispatchId).push(doc);
  }
  return grouped;
}

async function main() {
  const [payments, payouts, feedbacks] = await Promise.all([
    loadCollection("service_payments"),
    loadCollection("responder_payouts"),
    loadCollection(collections.dispatchFeedback),
  ]);

  const paymentsByDispatch = groupByDispatch(payments);
  const payoutsByDispatch = groupByDispatch(payouts);
  const feedbackByDispatch = groupByDispatch(feedbacks);
  const dispatchIds = new Set([
    ...paymentsByDispatch.keys(),
    ...payoutsByDispatch.keys(),
    ...feedbackByDispatch.keys(),
  ]);

  const restored = [];
  const skipped = [];

  for (const dispatchId of dispatchIds) {
    const existing = await db.collection(collections.dispatches).doc(dispatchId).get();
    if (existing.exists) {
      skipped.push({ id: dispatchId, reason: "already_exists" });
      continue;
    }

    const dispatchPayments = paymentsByDispatch.get(dispatchId) ?? [];
    const dispatchPayouts = payoutsByDispatch.get(dispatchId) ?? [];
    const dispatchFeedbacks = feedbackByDispatch.get(dispatchId) ?? [];
    const sortedPayments = [...dispatchPayments]
      .sort((a, b) => asMillis(b.updated_at || b.created_at) - asMillis(a.updated_at || a.created_at));
    const payment = sortedPayments.find((item) => item.status === "completed") ?? sortedPayments[0] ?? null;
    const payout =
      dispatchPayouts.find((item) => item.status === "paid") ??
      dispatchPayouts.sort((a, b) => asMillis(b.updated_at || b.requested_at || b.created_at) - asMillis(a.updated_at || a.requested_at || a.created_at))[0] ??
      null;
    const firstFeedback = dispatchFeedbacks[0] ?? null;
    const motoristFeedback = dispatchFeedbacks.find((item) => item.reviewer_role === "motorist" || item.reviewee_role === "motorist");
    const agentFeedback = dispatchFeedbacks.find((item) => item.reviewer_role === "agent" || item.reviewee_role === "agent");
    const motoristUserId =
      payment?.motorist_user_id ??
      payout?.motorist_user_id ??
      (motoristFeedback?.reviewer_role === "motorist" ? motoristFeedback.reviewer_user_id : motoristFeedback?.reviewee_user_id) ??
      "";
    const responderUserId =
      payment?.responder_user_id ??
      payout?.responder_user_id ??
      (agentFeedback?.reviewer_role === "agent" ? agentFeedback.reviewer_user_id : agentFeedback?.reviewee_user_id) ??
      "";
    const createdAt = oldest([
      payment?.created_at,
      payout?.created_at,
      payout?.requested_at,
      firstFeedback?.created_at,
      firstFeedback?.submitted_at,
    ]);
    const completedAt = newest([
      payment?.paid_at,
      payout?.paid_at,
      ...dispatchFeedbacks.map((item) => item.submitted_at || item.created_at),
    ]);
    const status = dispatchStatusFromPayment(payment, payout, dispatchFeedbacks);

    const restoredDispatch = pruneUndefined({
      id: dispatchId,
      emergency_report_id: firstFeedback?.emergency_report_id ?? firstFeedback?.emergencyReportId ?? null,
      repair_shop_id: null,
      responder_user_id: responderUserId,
      agent_user_id: responderUserId,
      dispatch_status: status,
      accepted_at: createdAt,
      arrived_at: createdAt,
      service_completed_at: status === "completed" || status === "payment_pending" ? createdAt : null,
      completed_at: status === "completed" ? completedAt : null,
      total_amount: payment?.amount ?? payout?.charged_total_amount ?? null,
      base_service_amount: payment?.base_service_amount ?? payout?.gross_amount ?? null,
      payout_transfer_fee: payment?.payout_transfer_fee ?? payout?.payout_transfer_fee ?? null,
      service_amount: payment?.service_amount ?? payout?.net_amount ?? null,
      commission_amount: payment?.commission_amount ?? payout?.commission_amount ?? null,
      commission_rate: payment?.commission_rate ?? null,
      payment_status: paymentStatusFromPayment(payment),
      payment_method: payment?.provider === "paymongo" ? "online_payment" : payment ? "soteria_credits" : null,
      payout_status: payoutStatusFromPayout(payout, payment),
      payout_transferred_at: payout?.status === "paid" ? payout?.paid_at ?? null : null,
      transfer_reference: payout?.transfer_reference ?? payment?.reference ?? null,
      service_payment_id: payment?.id ?? payout?.service_payment_id ?? null,
      responder_payout_id: payout?.id ?? null,
      motorist_subscription_status: "inactive",
      motorist_subscription_plan: null,
      credit_balance_after: null,
      restored_from: "service_payments/responder_payouts/dispatch_feedback",
      restored_at: serverTimestamp(),
      created_at: createdAt ?? serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    if (!dryRun) {
      await db.collection(collections.dispatches).doc(dispatchId).set(restoredDispatch);

      if (restoredDispatch.emergency_report_id) {
        const reportRef = db.collection(collections.emergencyReports).doc(restoredDispatch.emergency_report_id);
        const report = await reportRef.get();
        if (report.exists) {
          await reportRef.update({
            report_status: status === "completed" ? "completed" : status === "payment_pending" ? "awaiting_payment" : "matched",
            updated_at: serverTimestamp(),
          });
        }
      }
    }

    restored.push({
      id: dispatchId,
      status,
      motoristUserId,
      responderUserId,
      servicePaymentId: restoredDispatch.service_payment_id,
      responderPayoutId: restoredDispatch.responder_payout_id,
      emergencyReportId: restoredDispatch.emergency_report_id,
    });
  }

  console.log(JSON.stringify({ dryRun, restoredCount: restored.length, skippedCount: skipped.length, restored, skipped }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
