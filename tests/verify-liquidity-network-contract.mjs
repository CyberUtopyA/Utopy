import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const cart = await read("src/components/carrito.tsx");
assert.doesNotMatch(cart, /kind:\s*["']market\.order\.create/);
assert.doesNotMatch(cart, /sellerId\s*=\s*activeCajero|sellerId:\s*activeCajero|activeCajero\?\.id\s*\?\?\s*p\?\.seller/i);

const pay = await read("src/pay/utopyPay.ts");
assert.match(pay, /publishAuthorizedDV/);
assert.match(pay, /verifyAuthorizedDV/);
assert.match(pay, /confirmationMatches/);
assert.doesNotMatch(pay, /signUtopyPayload|verifyUtopySignature/);
assert.match(pay, /confirmationIds/);

const outcome = await read("src/mt/mt.intentpayment.ts");
assert.match(outcome, /action:\s*["']payment\.outcome/);
assert.match(outcome, /actingAsNodeId:\s*authority/);

const credit = await read("src/liquidity/creditNetwork.ts");
for (const token of [
  "buildCreditOfferDV",
  "matchCreditOffers",
  "buildCreditRequestDV",
  "buildCreditDecisionDV",
  "findReusableCreditAccount",
  "buildCreditAccountDV",
]) assert.match(credit, new RegExp(token));
assert.match(credit, /habitualRelationship/);
assert.doesNotMatch(credit, /personalScore|creditScore|globalScore/);

const checkout = await read("src/pages/checkoutmodal.tsx");
assert.match(checkout, /selectedFinanceOptionId/);
assert.match(checkout, /financeNodeId/);
assert.match(checkout, /sellerNodeId:\s*targetNodeId/);
assert.match(checkout, /buildValueRedemptionRequestDV/);
assert.match(checkout, /orderLineId/);

const vault = await read("src/vault/vault.engine.ts");
assert.match(vault, /value\.redemption\.request/);
assert.match(vault, /issuerConfirmedRedemption/);
assert.match(vault, /verifiedIds/);

const identity = await read("src/utopy/identityLink.ts");
for (const state of [
  "identity.link.request",
  "identity.link.challenge",
  "identity.link.proof",
  "identity.link.accepted",
  "identity.link.active",
  "identity.link.revoke.request",
  "identity.link.revoked",
]) assert.match(identity, new RegExp(state.replaceAll(".", "\\.")));
assert.match(identity, /customerIdShared:\s*false/);

const inventory = await read("src/mt/mt.inventoryBridge.ts");
assert.match(inventory, /verifyMarketOrderNodeAction/);
assert.match(inventory, /orderLineId/);
assert.match(inventory, /market\.order\.accept/);

const liquidity = await read("src/liquidity/mt.liquidity.ts");
assert.match(liquidity, /state:\s*["']planned/);
assert.match(liquidity, /custody:\s*["']none/);
assert.match(liquidity, /autoSettled:\s*false/);
assert.match(liquidity, /obligations/);

const projector = await read("src/value/liquidityNetwork.ts");
assert.match(projector, /projectLiquidityNetwork/);
assert.match(projector, /generatedOutcomes/);
assert.match(projector, /verifiedContributions/);
assert.match(projector, /settlementPlans/);

const map = await read("src/pages/CircularChainPanel.tsx");
assert.match(map, /import\.meta\.env\.DEV/);
assert.match(map, /Ninguna simulación se publica como actividad real/);

const shell = await read("src/components/FalconShell.tsx");
assert.match(shell, /<FalconDock\s*\/>/);

console.log("✓ contrato Mi Valor + Red de Liquidez verificado");
