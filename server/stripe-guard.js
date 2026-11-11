'use strict';

function shouldApplySubscriptionEvent(workspace, event) {
  if (!workspace) return false;
  const subscriptionId = event?.data?.object?.id;
  if (!subscriptionId) return false;
  const created = Number(event.created) || 0;
  const lastCreated = Number(workspace.stripe_last_event_created) || 0;
  const lastSubscriptionId = workspace.stripe_last_subscription_id || null;
  const isCreated = event.type === 'customer.subscription.created';
  const stale = created < lastCreated || (created === lastCreated && lastSubscriptionId && lastSubscriptionId !== subscriptionId);
  const wrongSubscription = Boolean(workspace.stripe_subscription_id && workspace.stripe_subscription_id !== subscriptionId);
  const resurrected = !workspace.stripe_subscription_id && lastSubscriptionId === subscriptionId && !isCreated;
  const replaced = Boolean(lastSubscriptionId && lastSubscriptionId !== subscriptionId && (!isCreated || created <= lastCreated));
  return !stale && !wrongSubscription && !resurrected && !replaced;
}

function matchingPlan(priceIds, starterPriceId, proPriceId) {
  if (proPriceId && priceIds.includes(proPriceId)) return 'pro';
  if (starterPriceId && priceIds.includes(starterPriceId)) return 'starter';
  return null;
}

module.exports = { shouldApplySubscriptionEvent, matchingPlan };
