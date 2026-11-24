import React, { Suspense, lazy, useMemo, useState, useEffect, useRef } from "react";
import styled from "styled-components";
import { matchIntentWithCapabilities } from "../utopy/presence/resonance.matcher";
import {
  collectHumanLiveActivity,
  liveNodeId,
  liveTitle,
  resolveLiveImage,
  resolveLiveSeller,
} from "../mt/livePresentation";
import { projectUniversalProduct } from "../mt/universalProduct";
import { measureDev } from "../utils/devPerformance";
import { projectLiquidityProximity } from "../liquidity/projectLiquidityProximity";
import { profileHandleForIdentity } from "../mt/productRoute";
import { useLocation, useNavigate } from "react-router-dom";
import { Activity, Search, SlidersHorizontal, Mic } from "lucide-react";
import { canonicalSpaceRef, useLivingSpaceNavigation, interpretSpaceCommand } from "../utopy/livingSpaceNavigation";
import { useContextualVoice } from "../utopy/useContextualVoice";
import { useLivingCapabilities } from "../utopy/useLivingCapabilities";
import { publicLivingSignals } from "../utopy/livingSpaceRelevance";
import LivingCapabilityDetails from "../components/LivingCapabilityDetails";
import { canAccessEnvelope } from "utopy/continuity";
import { livingGlass, LivingModalBackdrop } from "./circularModal";
import { humanVisibleText } from "../social/liveNetwork.human";
import { isPublicLivingDV, projectLivingNodes } from "../utopy/livingNodeProjection";
import { canRelate, distanceKmBetween, publicGeoPoint, relationActionOf } from "../utopy/territorialCompatibility";
import {
  compositionAsDiscoveryIntent,
  isPublicLivingComposition,
  matchLivingCompositionCandidates,
} from "../utopy/livingCompositionDiscovery";

const CircularGeographicMap = lazy(() => import("./circularGeographicMap"));

const Wrap = styled.div`
  width: 100%;
  height: 100%;
  min-height: 0;
  display: grid;
`;
const Shell = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 0;
  overflow: hidden;
  background: #eef4f1;
  border: 0;
  box-shadow: none;

  @media (max-width: 900px) {
    border-radius: 0;
  }
`;

const MapSearch = styled.label`
  position: absolute;
  z-index: 530;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  width: min(600px, calc(100% - 240px));
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 13px 18px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.08);
  background: rgba(255,255,255,.94);
  color: #0f172a;
  box-shadow: 0 7px 22px rgba(32,47,99,.09);
  backdrop-filter: blur(18px);
  svg{width:20px;height:20px;color:#495d85;flex:0 0 auto}
  input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; font: inherit; font-size:15px;color:#172444; }
  button{border:0;background:transparent;border-radius:50%;padding:4px;cursor:pointer}
  @media (max-width: 900px) { top:10px;left: 10px;transform:none;width:calc(100% - 112px);box-sizing:border-box;padding:8px 12px;min-height:44px;input{font-size:16px}button{min-width:32px;min-height:32px} }
`;

const SearchResults = styled.div`
  ${livingGlass};
  position: absolute;
  z-index: 529;
  top: 76px;
  left: 18px;
  width: min(500px, calc(100% - 38px));
  display: grid;
  gap: 5px;
  max-height: min(52dvh, 420px);
  overflow: auto;
  padding: 7px;
  border-radius: 22px;
  button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 9px;
    border: 0;
    border-radius: 13px;
    padding: 9px 10px;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }
  button:hover { background: rgba(255,255,255,.72); }
  button div { min-width: 0; display: grid; }
  b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #0f172a; font-size: 13px; }
  span { color: #64748b; font-size: 11px; }
  @media (max-width: 600px) { top:70px;left:10px;width:calc(100% - 20px); }
`;

const PointSheet = styled.div`
  ${livingGlass};
  position: absolute;
  z-index: 820;
  left: 50%;
  bottom: 104px;
  transform: translateX(-50%);
  width: min(520px, calc(100% - 32px));
  max-height: min(70%, 620px);
  padding: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  .point-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 2px 4px 12px 0; scrollbar-width: thin; }
  .close { position: absolute; z-index: 2; right: 15px; top: 15px; width:38px;height:38px;border:1px solid rgba(192,202,227,.5);border-radius:999px;background:rgba(255,255,255,.88);color:#34415e;font-size:24px;line-height:1;cursor:pointer;box-shadow:0 5px 16px #28304f12; }
  .eyebrow { padding-right: 30px; color: #64748b; font-size: 12px; font-weight: 800; }
  h3 { margin: 8px 42px 6px 0; font-size: clamp(20px,2vw,26px);line-height:1.14;letter-spacing:-.035em; }
  p { margin: 0 0 9px; color: #64748b; font-size: 13px;line-height:1.45; }
  @media (max-width: 700px) {
    left: 8px;
    right: 8px;
    bottom: calc(90px + env(safe-area-inset-bottom));
    width: auto;
    max-height: min(68dvh, calc(100% - 122px));
    padding: 18px 16px 14px;
    transform: none;
    border-radius: 28px;
  }
`;

const ActivityToggle = styled.button`
  position: absolute;
  z-index: 535;
  top: max(20px, env(safe-area-inset-top));
  right: 132px;
  border: 1px solid rgba(255,255,255,.78);
  border-radius: 999px;
  width:42px;height:42px;padding:0;display:grid;place-items:center;
  background: rgba(255,255,255,.94);
  color: #0f172a;
  box-shadow: 0 12px 34px rgba(15,23,42,.13);
  backdrop-filter: blur(18px);
  cursor: pointer;
  svg{width:19px;height:19px}
  @media (max-width: 700px) { top:max(15px, env(safe-area-inset-top)); right: 113px;width:40px;height:40px; }
`;

const ActivitySheet = styled.aside`
  ${livingGlass};
  position: absolute;
  z-index: 800;
  top: 74px;
  right: 16px;
  bottom: 86px;
  width: min(370px, calc(100% - 32px));
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid rgba(107,119,178,.12); }
  header div { display: grid; gap: 2px; }
  header b { font-size: 16px; }
  header span { color: #64748b; font-size: 12px; }
  header button { width:32px;height:32px;border:0;border-radius:999px;background:rgba(255,255,255,.68);color:#53618a;cursor:pointer;font-size:21px; }
  .feed { min-height: 0; overflow: auto; padding: 8px; }
  .activity { width: 100%; display: grid; grid-template-columns: 34px 1fr auto; gap: 9px; align-items: start; border: 0; border-radius: 16px; padding: 10px; background: transparent; color: inherit; text-align: left; cursor: pointer; }
  .activity:hover { background: rgba(255,255,255,.66); }
  .activity .icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 13px; background: rgba(255,255,255,.7); }
  .activity .copy { min-width: 0; display: grid; gap: 2px; }
  .activity b { font-size: 12px; }
  .activity small { color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .activity time { color: #94a3b8; font-size: 10px; white-space: nowrap; }
  .empty { padding: 24px 16px; color: #64748b; text-align: center; }
  @media (max-width: 700px) {
    top: auto;
    left: 8px;
    right: 8px;
    bottom: calc(8px + env(safe-area-inset-bottom));
    width: auto;
    height: min(58%, 470px);
    border-radius: 26px 26px 18px 18px;
  }
`;

const MoreFiltersSheet = styled.aside`
  ${livingGlass};
  position: absolute;
  z-index: 546;
  left: 18px;
  top: 208px;
  bottom: auto;
  width: min(410px, calc(100% - 36px));
  max-height: calc(100dvh - 220px);
  overflow: auto;
  border-radius: 25px;
  padding: 10px;
  header { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px 6px 10px; }
  header div { display:grid;gap:2px; }
  header b { font-size:14px; }
  header span { color:#64748b;font-size:11px; }
  header button { width:34px;height:34px;border:0;border-radius:999px;background:rgba(255,255,255,.68);color:#53618a;cursor:pointer;font-size:20px; }
  > div { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px; }
  > div button { border:1px solid rgba(255,255,255,.9);border-radius:16px;padding:11px;background:rgba(255,255,255,.58);display:flex;align-items:center;gap:8px;cursor:pointer;text-align:left; }
  > div button[data-active="true"] { border-color:#a7b4ef;background:rgba(231,235,255,.9); }
  > div button span { font-size:18px; }
  > div button b { font-size:12px; }
  @media (max-width:700px) { left:8px;right:8px;top:112px;width:auto;max-height:calc(100% - 200px);border-radius:24px; }
`;

const NetworkMatches = styled.div`
  display: grid;
  gap: 7px;
  margin: 12px 0;
  padding-top: 11px;
  border-top: 1px solid rgba(15, 23, 42, .09);
  > strong { font-size: 12px; color: #475569; }
  .match {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 9px 11px;
    border-radius: 14px;
    background: rgba(255,255,255,.58);
  }
  .match div { min-width: 0; display: grid; gap: 1px; }
  .match b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
  .match span { color: #64748b; font-size: 11px; }
  .score { flex: 0 0 auto; color: #166534; font-size: 12px; font-weight: 950; }
`;

const NodeProducts = styled.div`
  display: grid;
  gap: 7px;
  margin: 12px 0;
  padding-top: 11px;
  border-top: 1px solid rgba(15, 23, 42, .09);
  > strong { color: #475569; font-size: 12px; }
  button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border: 0;
    border-radius: 14px;
    padding: 10px 11px;
    background: rgba(255,255,255,.58);
    color: #0f172a;
    text-align: left;
    cursor: pointer;
  }
  button:hover { background: rgba(255,255,255,.86); }
  button b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
  button span { flex: 0 0 auto; color: #5866bd; font-size: 12px; font-weight: 900; }
`;

const CompositeHint = styled.div`
  margin: 9px 0;
  padding: 10px 11px;
  border-radius: 14px;
  background: rgba(255,255,255,.6);
  color: #43548d;
  font-size: 12px;
  font-weight: 800;
`;

const LiquidityRail = styled.div`
  position:absolute;z-index:534;left:16px;bottom:82px;width:min(330px,calc(100% - 32px));display:grid;gap:6px;
  button{display:grid;gap:2px;padding:10px 12px;border:1px solid rgba(20,120,65,.18);border-radius:16px;background:rgba(247,255,249,.94);box-shadow:0 10px 28px rgba(15,23,42,.12);text-align:left;cursor:pointer;backdrop-filter:blur(14px)}
  b{font-size:12px;color:#155e36}span{font-size:10px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  @media(max-width:700px){left:8px;bottom:74px;width:calc(100% - 16px);grid-template-columns:repeat(2,minmax(0,1fr));button:nth-child(n+3){display:none}}
`;
const MapPublicationRail = styled.details`
  position:absolute;z-index:530;right:16px;bottom:100px;width:60px;
  &[open]{width:min(280px,calc(100% - 32px))}
  summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;min-height:44px;font-size:12px;font-weight:800;color:#475584;padding:8px;border-radius:18px;border:1px solid #e1e5ee;background:rgba(255,255,255,.94);box-shadow:0 6px 18px #1f29371a}summary::-webkit-details-marker{display:none}summary sup{font-size:10px}
  >div{display:grid;gap:7px;max-height:220px;overflow:auto;padding-top:7px;overscroll-behavior:contain}
  button{display:grid;gap:3px;padding:11px 13px;border:1px solid rgba(255,255,255,.94);border-radius:18px;background:rgba(246,245,255,.89);color:#334163;box-shadow:0 8px 24px rgba(61,72,125,.12);text-align:left;cursor:pointer;backdrop-filter:blur(12px)}
  button b{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}button span{font-size:10px;color:#687492}
  @media(max-width:700px){right:8px;bottom:calc(100px + env(safe-area-inset-bottom,0px));&[open]{width:min(245px,calc(100% - 16px))}>div{max-height:min(30dvh,220px)}}
`;

const CircularScene = styled.div`
  position:absolute;inset:181px 14px 86px;overflow:hidden;border-radius:34px;
  background:radial-gradient(circle at 50% 51%,rgba(237,204,142,.30),transparent 24%),
    radial-gradient(circle at 28% 24%,rgba(213,228,235,.32),transparent 30%),
    linear-gradient(145deg,#fffdf8,#f7f8f7 62%,#f7f9fc);
  border:1px solid rgba(210,192,163,.23);
  @media(max-width:700px){inset:112px 8px 92px;border-radius:27px}
`;
const FeedScene = styled.div`
  position:absolute;inset:181px 14px 88px;overflow:auto;border-radius:30px;padding:clamp(18px,2.4vw,36px);
  background:radial-gradient(circle at 12% 5%,#fffaf0,transparent 36%),linear-gradient(145deg,#fffdfb,#f2f5f7);border:1px solid rgba(210,192,163,.25);
  .feed-heading{display:flex;justify-content:space-between;align-items:end;gap:16px;margin:0 0 20px;color:#1a2533}
  .feed-heading h2{font-size:clamp(22px,2.2vw,34px);letter-spacing:-.045em;margin:0 0 4px}
  .feed-heading p{margin:0;color:#77828d;font-size:13px}
  .feed-count{font-size:12px;color:#936f3c;background:#fff5e4;border-radius:999px;padding:8px 12px;white-space:nowrap}
  .feed-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,245px),1fr));gap:16px;align-content:start}
  .feed-grid[data-sparse="true"]{grid-template-columns:minmax(0,860px);justify-content:center}
  .feed-grid[data-sparse="true"]>button{min-height:310px;flex-direction:row}
  .feed-grid[data-sparse="true"] .feed-avatar{width:48%;height:auto;min-height:310px}
  .feed-grid[data-sparse="true"] .feed-copy{justify-content:center;padding:clamp(20px,4vw,54px);gap:12px}
  .feed-grid[data-sparse="true"] .feed-copy b{font-size:clamp(22px,2vw,32px)}
  .feed-grid>button{min-width:0;display:flex;flex-direction:column;gap:0;padding:0;border:1px solid #e9e8e5;border-radius:25px;overflow:hidden;background:#fff;color:#182235;text-align:left;cursor:pointer;box-shadow:0 10px 28px #1822380d;transition:transform .18s ease,box-shadow .18s ease}
  .feed-grid>button:hover{transform:translateY(-3px);box-shadow:0 18px 38px #1822381c}
  >button[aria-pressed="true"]{border-color:#c8a66e;box-shadow:0 0 0 3px #e7d4b28a}
  .feed-grid>button[aria-pressed="true"]{border-color:#c8a66e;box-shadow:0 0 0 3px #e7d4b28a}
  .feed-avatar{width:100%;height:clamp(145px,18vw,230px);background:linear-gradient(135deg,#f2e9dc,#e7eef3);display:grid;place-items:center;overflow:hidden;font-size:54px}
  .feed-avatar img{width:100%;height:100%;object-fit:cover}
  .feed-copy{display:grid;gap:6px;padding:16px;min-width:0}
  .feed-copy b{font-size:16px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .feed-copy small{font-size:12px;color:#78818e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .feed-copy em{font-size:11px;color:#8f6b39;font-style:normal;font-weight:800}
  @media(max-width:700px){inset:175px 8px 170px;padding:16px;border-radius:24px;.feed-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.feed-avatar{height:135px}.feed-copy{padding:11px}.feed-copy b{font-size:13px}.feed-heading{margin-bottom:14px}.feed-grid[data-sparse="true"]>button{min-height:0;flex-direction:column}.feed-grid[data-sparse="true"] .feed-avatar{width:100%;height:200px;min-height:0}.feed-grid[data-sparse="true"] .feed-copy{padding:18px}}
  @media(max-width:390px){.feed-grid{grid-template-columns:1fr}.feed-avatar{height:180px}}
  @media(prefers-reduced-motion:reduce){.feed-grid>button{transition:none}}
`;
const MapLoading = styled.div`
  position:absolute;inset:181px 14px 88px;display:grid;place-items:center;background:#f5f6f4;border-radius:28px;color:#617080;font-size:13px;font-weight:750;
  @media(max-width:700px){inset:175px 8px 170px}
`;
const SceneRing = styled.div`
  position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border:1px solid rgba(194,166,114,.18);border-radius:50%;pointer-events:none;
  &.ring-one{width:min(39%,310px);aspect-ratio:1;background:rgba(255,255,255,.21)}
  &.ring-two{width:min(65%,580px);aspect-ratio:1;border-style:dashed;border-color:rgba(180,188,194,.25)}
  &.ring-three{width:min(91%,880px);aspect-ratio:1;border-color:rgba(194,166,114,.11)}
  @media(max-width:700px){&.ring-one{width:54%}&.ring-two{width:83%}&.ring-three{width:120%}}
`;
const SceneLinks = styled.svg`
  position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;
  line{vector-effect:non-scaling-stroke;stroke-width:1.5;stroke:#c4a770;opacity:.46}
  line.suggested{stroke-dasharray:4 7}
  line.scheduled{stroke-dasharray:9 6;stroke:#d09b66}
  line.active{stroke:#6aaea1;opacity:.68}
  line.related{stroke:#6aaea1;opacity:.6;stroke-width:2}
`;
const SceneCenter = styled.div`
  position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2;width:min(30%,250px);min-width:180px;aspect-ratio:1;border-radius:50%;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:22px;text-align:center;
  background:radial-gradient(circle at 50% 35%,#fff 30%,#fff9ec 78%,#f6e9cd);border:1px solid rgba(218,188,135,.6);
  box-shadow:0 20px 65px rgba(165,133,75,.14),0 0 0 10px rgba(255,255,255,.52);
  span{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#ae8549;font-weight:900}
  strong{font-size:clamp(17px,2vw,24px);line-height:1.15;letter-spacing:-.04em;max-height:4.6em;overflow:hidden}
  small{font-size:11px;line-height:1.3;color:#79808a}
  @media(max-width:700px){min-width:144px;width:43%;padding:12px;gap:5px;strong{font-size:17px}small{font-size:9px}}
`;
const SceneNode = styled.button`
  position:absolute;left:var(--scene-x);top:var(--scene-y);transform:translate(-50%,-50%);z-index:3;
  width:min(22%,202px);min-width:142px;min-height:76px;display:flex;align-items:center;gap:9px;padding:9px;
  border:1px solid rgba(255,255,255,.92);border-radius:22px;background:rgba(255,255,255,.86);color:#19222e;
  box-shadow:0 13px 37px rgba(37,43,54,.09);backdrop-filter:blur(12px);text-align:left;cursor:pointer;
  .scene-symbol{width:47px;height:47px;flex:0 0 auto;display:grid;place-items:center;border-radius:17px;background:#f4eee4;font-size:21px;overflow:hidden}
  .scene-symbol img{width:100%;height:100%;object-fit:cover}
  .domain-finance{background:#fff0d8}.domain-delivery{background:#e7f5fb}.domain-production{background:#eaf6eb}.domain-spaces{background:#e9f0ff}
  .scene-copy{display:grid;gap:3px;min-width:0}.scene-copy b{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.scene-copy small{font-size:10px;color:#78818e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  &:hover{transform:translate(-50%,-50%) scale(1.025);box-shadow:0 16px 42px rgba(37,43,54,.14)}
  &[aria-pressed="true"]{border-color:#bd9c63;box-shadow:0 0 0 3px #e7d4b28a,0 13px 37px rgba(37,43,54,.12)}
  &:focus-visible{outline:3px solid #8c79bf;outline-offset:4px}
  &[aria-pressed="true"] .scene-symbol{box-shadow:0 5px 12px #c4a77030;transform:translateY(-2px)}
  @media(max-width:700px){width:clamp(96px,29vw,126px);box-sizing:border-box;min-width:0;min-height:60px;padding:7px;gap:5px;border-radius:17px;.scene-symbol{width:30px;height:30px;border-radius:11px;font-size:16px}.scene-copy b{font-size:10px}.scene-copy small{font-size:9px}}
  @media(prefers-reduced-motion:no-preference){transition:transform .18s ease,box-shadow .18s ease}
  @media(prefers-reduced-motion:reduce){&:hover{transform:translate(-50%,-50%)}&[aria-pressed="true"] .scene-symbol{transform:none}}
`;
const SceneEmpty = styled.p`
  position:absolute;left:50%;bottom:17px;transform:translateX(-50%);margin:0;width:min(90%,380px);text-align:center;color:#81858c;font-size:12px;
`;
const Vignette = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,0.28) 0%,
      transparent 24%,
      transparent 72%,
      rgba(15,23,42,0.08) 100%
    ),
    radial-gradient(circle at center, transparent 68%, rgba(15,23,42,0.06) 100%);
  z-index: 400;
`;

const Subtle = styled.div`
  font-size: 13px;
  opacity: 0.78;
  line-height: 1.45;
`;

const ControlDock = styled.div`
  position: absolute;
  z-index: 510;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 24px);
  top: 84px;
  bottom: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;

  @media (max-width: 900px) {
    width: calc(100% - 16px);
    top: 62px;
    flex-direction:row;
    justify-content:center;
    gap:6px;
    pointer-events:none;
    > *{pointer-events:auto;}
  }
`;
const ProjectionTabs = styled.div`
  display:inline-flex;align-items:center;gap:5px;padding:0;background:transparent;
  button{border:1px solid rgba(210,215,220,.7);border-radius:999px;background:rgba(255,255,255,.88);color:#5d6673;padding:7px 17px;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px #1822380c}
  button[aria-pressed="true"]{background:#141820;color:#fff}
  @media(max-width:700px){button{padding:7px 12px;font-size:11px}}
  @media(max-width:400px){gap:3px;button{min-height:40px;padding:6px 10px;font-size:11px}}
`;
const FilterPanel = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  align-items: center;
  width: max-content;
  padding: 0;
  background: transparent;
  min-width: 0;
  overflow-x: auto;
  max-width: 100%;

  &::-webkit-scrollbar {
    display: none;
  }
  @media(max-width:900px){width:auto;flex:0 1 auto;gap:4px;}
`;
const FilterBtn = styled.button`
  border: 1px solid ${({ $active }) => ($active ? "rgba(203,166,111,.55)" : "rgba(0,0,0,0.05)")};
  border-radius: 999px;
  padding: 9px 13px;
  background: ${({ $active }) =>
    $active ? "#141820" : "rgba(255,255,255,0.64)"};
  color: ${({ $active }) => $active ? "#fff" : "#28313d"};
  cursor: pointer;
  font-weight: 950;
  font-size: 12px;
  display:flex;align-items:center;gap:7px;
  svg{width:16px;height:16px}
  box-shadow: ${({ $active }) =>
    $active ? "0 8px 19px rgba(18,24,32,.16)" : "none"};
  white-space: nowrap;
  @media(max-width:900px){
    display:${({ $active }) => $active ? "flex" : "none"};
    min-height:40px;padding:7px 10px;font-size:11px;
    &[aria-label]{display:flex;font-size:0;gap:0;width:40px;justify-content:center;}
  }
`;

const EmptyState = styled.div`
  position: absolute;
  z-index: 520;
  left: 50%;
  top: 55%;
  transform: translate(-50%, -50%);
  width: min(420px, calc(100% - 32px));
  border: 1px solid rgba(15,23,42,0.08);
  border-radius: 28px;
  background: rgba(255,255,255,.92);
  color: #0f172a;
  backdrop-filter: blur(20px);
  box-shadow: 0 24px 70px rgba(0,0,0,0.24);
  padding: 18px;
  text-align: center;
`;

const EmptyIcon = styled.div`
  width: 58px;
  height: 58px;
  margin: 0 auto 10px;
  border-radius: 22px;
  display: grid;
  place-items: center;
  background: rgba(21,255,0,0.14);
  border: 1px solid rgba(21,255,0,0.22);
  font-size: 26px;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 8px;
  flex: 0 0 auto;
  padding-top: 14px;
  border-top: 1px solid rgba(142,155,191,.18);
  >button:last-child { grid-column: 1 / -1; grid-row: 1; }
  @media(max-width:700px){padding-top:12px;gap:7px}
`;

const Btn = styled.button`
  border: 1px solid rgba(255,255,255,.92);
  border-radius: 16px;
  padding: 11px 15px;
  background: ${({ $ghost }) =>
    $ghost ? "rgba(255,255,255,.65)" : "linear-gradient(135deg,#7084eb,#9e8dec)"};
  color: ${({ $ghost }) => $ghost ? "#42548d" : "#fff"};
  cursor: pointer;
  font-weight: 850;
  min-height: 44px;
  text-align: center;
  @media(max-width:700px){padding:10px 8px;font-size:12px}
  box-shadow: ${({ $ghost }) => ($ghost ? "none" : "0 10px 24px rgba(100,111,199,.22)")};
`;

function safeStr(x, fb = "") {
  return typeof x === "string" ? x : x == null ? fb : String(x);
}

function toNum(x, fb = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fb;
}

function normKey(x) {
  return safeStr(x).trim().toLowerCase();
}

const CIRCULAR_MODES = [
  ["all", "Todo"], ["need", "Necesito"], ["offer", "Tengo"],
  ["delivery", "Mover"], ["production", "Producir"],
  ["deliver", "Entregar"], ["spaces", "Vivir"], ["finance", "Capital"],
];
const CIRCULAR_SLOTS = [
  { x: 50, y: 16 }, { x: 76, y: 31 }, { x: 76, y: 69 },
  { x: 50, y: 84 }, { x: 24, y: 69 }, { x: 24, y: 31 },
];

function semanticWords(value) {
  return safeStr(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !/^(quiero|necesito|para|algo|una|uno|los|las|que|con|por|del|como|esto|esta|hoy)$/.test(word));
}

function circularDomain(point, text) {
  if (point.liquidity || /finance|credit|capital|financia/.test(text)) return "finance";
  if (/delivery|entrega|transport|logistic|pickup|mover|repart/.test(text)) return "delivery";
  if (/property|rental|alquiler|vivienda|housing|inmueble|espacio/.test(text)) return "spaces";
  if (/produc|manufact|fabric|taller|material|supply|abastec|insumo|cultiv/.test(text)) return "production";
  return "general";
}

function publishedEtaMinutes(point) {
  const attrs = point?.raw?.attrs || {};
  const value = Number(attrs.etaMinutes ?? attrs.deliveryEtaMinutes ?? attrs.delivery?.estimatedMinutes);
  return Number.isFinite(value) && value > 0 && value < 1440 ? Math.round(value) : null;
}

function matchesCircularMode(point, mode, text) {
  const domain = circularDomain(point, `${point.kind} ${text}`.toLowerCase());
  if (mode === "all") return true;
  if (mode === "need") return /offer|capability|node|finance|product/.test(point.kind);
  if (mode === "offer") return /need|demand|intent|work/.test(point.kind);
  if (mode === "deliver") return /delivery|need|demand|work/.test(point.kind) && domain === "delivery";
  if (mode === "work") return /work|trabaj|empleo|servicio/.test(`${point.kind} ${text}`);
  if (mode === "material") return /material|insumo|supply|recurso/.test(`${point.kind} ${text}`);
  if (mode === "commerce") return /node|product|offer|comercio|tienda|store/.test(`${point.kind} ${text}`);
  if (mode === "circular") return /circular|waste|recovered|recicl|reutil/.test(`${point.kind} ${text}`);
  return domain === mode;
}

function projectCircularScene(livingNodes, geoPoints, publications, liquidity, mode, query, purchaseContext, origin, priorThreads, options = {}) {
  const nodes = livingNodes.map((node) => {
    const text = [node.name, node.bio, node.territory, ...node.capabilities.flatMap((cap) => [cap.label, ...cap.verbs, ...cap.resources]),
      ...node.products.slice(0, 12).flatMap((product) => [product.title, product.description, product.source?.meta?.cat, product.source?.attrs?.category])].filter(Boolean).join(" ");
    return { id: `living:${node.id}`, kind: "node", title: node.name, subtitle: node.bio || node.territory || "Nodo Vivo", raw: node.source,
      nodeProjection: node, productCount: node.products.filter((product) => product.available).length,
      lat: node.presence?.lat, lng: node.presence?.lng, threadId: null, semanticText: text, timestamp: 0 };
  });
  const productPoints = (options.productDVs || []).filter((dv) => isPublicLivingDV(dv) && /product|producto|mt:producto/i.test(safeStr(dv?.kind)) && !isExpired(dv)).map((dv) => {
    const product = projectUniversalProduct(dv);
    const node = livingNodes.find((item) => [item.id, item.nodeId, item.storeId, ...item.aliases].some((id) => id && id === liveNodeId(dv)));
    if (!product.available || !product.title || !dv?.id) return null;
    return { id: `feed-product:${dv.id}`, kind: "product", title: product.title, subtitle: node?.name || product.seller,
      raw: dv, nodeProjection: node, product, lat: node?.presence?.lat, lng: node?.presence?.lng,
      semanticText: [product.title, product.description, product.collection, node?.name, dv?.attrs?.category, dv?.meta?.cat].filter(Boolean).join(" ") };
  }).filter(Boolean);
  const candidates = [...(options.full ? productPoints : []), ...nodes, ...geoPoints, ...publications, ...liquidity];
  const seen = new Set();
  const words = semanticWords(query);
  const ranked = candidates.map((point) => {
    if (purchaseContext && !point.liquidity) return null;
    const nodeId = liveNodeId(point.raw);
    const key = canonicalSpaceRef(point) || nodeId;
    const text = safeStr(point.semanticText || `${point.title} ${point.subtitle} ${point.domain || ""} ${point.materialName || ""} ${point.raw?.attrs?.category || ""} ${(point.raw?.attrs?.tags || []).join?.(" ") || ""}`);
    const plain = semanticWords(text).join(" ");
    const matches = words.filter((word) => plain.includes(word)).length;
    const domain = circularDomain(point, `${point.kind} ${text}`.toLowerCase());
    const modeMatch = matchesCircularMode(point, mode, text);
    if (!modeMatch || (words.length && matches === 0)) return null;
    const candidateGeo = Number.isFinite(point.lat) && Number.isFinite(point.lng) ? { lat: point.lat, lng: point.lng } : null;
    const distanceKm = origin && candidateGeo ? distanceKmBetween(origin, candidateGeo) : null;
    const capability = { ...point.raw, attrs: { ...(point.raw?.attrs || {}), geo: candidateGeo, ranges: point.nodeProjection?.ranges || point.raw?.attrs?.ranges } };
    const relation = origin ? canRelate({ need: origin, capability, action: relationActionOf(point.raw), mode: "for_me" }) : null;
    const score = matches * 20 + (point.liquidity && purchaseContext ? 18 : 0) +
      (point.nodeProjection?.availability?.availableNow ? 6 : 0) + Math.min(point.productCount || 0, 4) +
      (point.nodeProjection?.availability?.availableNow === false ? -4 : 0) +
      (relation?.recommended ? 4 : 0) + (distanceKm != null ? 3 / (1 + distanceKm) : 0) +
      (point.threadId && priorThreads.has(point.threadId) ? 3 : 0) + (point.timestamp ? Math.max(0, 4 - (Date.now() - point.timestamp) / 86400000) : 0);
    return { point, key, score, matches, domain, distanceKm, relation };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  return ranked.filter((entry) => { if (seen.has(entry.key)) return false; seen.add(entry.key); return true; }).slice(0, options.full ? 80 : 6);
}

function hasTrait(dv, trait) {
  return Array.isArray(dv?.traits) && dv.traits.includes(trait);
}

function visibleToMapActor(dv, actorId) {
  const scopes = Array.isArray(dv?.meta?.scopes) ? dv.meta.scopes.map(String) : [];
  const participants = Array.isArray(dv?.attrs?.participants)
    ? dv.attrs.participants.map(String)
    : [];
  const restricted =
    dv?.meta?.sensitivity === "sensitive" ||
    (scopes.length > 0 && !scopes.includes("public"));
  if (dv?.meta?.runtimeEnvelope) {
    const envelope = dv.meta.runtimeEnvelope;
    return canAccessEnvelope(envelope, { actorId });
  }
  return !restricted || Boolean(actorId && (participants.includes(actorId) || dv?.attrs?.actorId === actorId));
}

function getCoords(dv) {
  return publicGeoPoint(dv);
}

function isExpired(dv, now = Date.now()) {
  const expires = Date.parse(String(dv?.attrs?.expiresAt || dv?.meta?.expiresAt || ""));
  if (Number.isFinite(expires) && expires <= now) return true;
  const ttl = Number(dv?.meta?.ttl_ms || dv?.attrs?.ttl_ms || 0);
  const rawTs = dv?.meta?.updatedAt || dv?.meta?.ts || dv?.attrs?.updatedAt || dv?.ts;
  const parsed = typeof rawTs === "number" ? (rawTs < 1e10 ? rawTs * 1000 : rawTs) : Date.parse(String(rawTs || ""));
  return ttl > 0 && Number.isFinite(parsed) && now > parsed + ttl;
}

function getMaterialKey(dv) {
  return normKey(
    dv?.attrs?.materialKey ||
      dv?.attrs?.productoId ||
      dv?.meta?.materialKey ||
      dv?.meta?.productKey
  );
}

function getMaterialName(dv) {
  return safeStr(
    dv?.attrs?.materialName ||
      dv?.attrs?.intent?.resources?.[0] ||
      dv?.attrs?.capabilities?.[0]?.resources?.[0] ||
      dv?.attrs?.title ||
      dv?.meta?.name ||
      dv?.attrs?.productoNombre ||
      "Material"
  );
}

function getQuantity(dv) {
  return toNum(
    dv?.attrs?.quantity ??
      dv?.attrs?.cantidad ??
      dv?.attrs?.stock ??
      0,
    0
  );
}

function getUnit(dv) {
  return safeStr(dv?.attrs?.unit || dv?.attrs?.unidad || "u");
}

function getThreadId(dv) {
  return safeStr(dv?.meta?.threadId || dv?.attrs?.threadId || "");
}

function relationKeys(dv) {
  return Array.from(new Set([
    dv?.id,
    dv?.attrs?.threadId,
    dv?.meta?.threadId,
    dv?.attrs?.chainId,
    dv?.meta?.chainId,
    dv?.attrs?.rootDvId,
    dv?.meta?.rootDvId,
    dv?.attrs?.parentDvId,
    dv?.meta?.parentDvId,
    dv?.attrs?.respondsTo,
    dv?.meta?.respondsTo,
    dv?.attrs?.signalRef?.id,
    dv?.attrs?.source?.dvId,
  ].map((value) => safeStr(value)).filter(Boolean)));
}

function threadIndexOf(allLive) {
  const index = new Map();
  for (const dv of allLive || []) {
    const threadId = getThreadId(dv);
    if (!threadId) continue;
    relationKeys(dv).forEach((key) => index.set(key, threadId));
  }
  return index;
}

function inheritedThreadId(dv, threadIndex) {
  const own = getThreadId(dv);
  if (own) return own;
  for (const key of relationKeys(dv)) {
    const threadId = threadIndex?.get(key);
    if (threadId) return threadId;
  }
  return "";
}

function getOrgId(dv) {
  return safeStr(dv?.attrs?.orgId || dv?.meta?.orgId || "");
}

function getTerritoryId(dv) {
  return safeStr(dv?.attrs?.territoryId || dv?.meta?.territoryId || "");
}

function getTitleForPoint(dv) {
  return [dv?.attrs?.intent?.summary, dv?.attrs?.text, dv?.attrs?.expression?.text, dv?.attrs?.description, dv?.attrs?.title, dv?.labels?.[0], dv?.attrs?.name]
    .map((value) => humanVisibleText(value, "")).find(Boolean) || (/manifest|profile|node/.test(String(dv?.kind || "")) ? "Perfil Vivo" : "Publicación viva");
}

function getSubtitleForPoint(dv) {
  return [dv?.attrs?.description, isPublicLivingComposition(dv) ? "Composición pública reutilizable" : "", dv?.labels?.[1], dv?.attrs?.category]
    .map((value) => humanVisibleText(value, "")).find(Boolean) || "";
}

function isCircularWork(dv) {
  return dv?.kind === "work.intent";
}

function isCircularOffer(dv) {
  return (
    dv?.kind === "mt:offer" &&
    (hasTrait(dv, "mt:circular") || hasTrait(dv, "mt:supply"))
  );
}

function isCircularDemand(dv) {
  return /^(mt:demand\.material|material\.need|supply\.need|value\.need|market\.demand)$/i.test(
    safeStr(dv?.kind),
  );
}

function actorKey(dv) {
  return safeStr(
    dv?.attrs?.actorId ||
      dv?.attrs?.actor?.id ||
      dv?.attrs?.personId ||
      dv?.attrs?.providerId ||
      dv?.attrs?.sellerId ||
      dv?.meta?.issuer,
  );
}

function mapEntityId(kind, dv, coords) {
  if (["node", "capability", "person.available", "finance"].includes(kind)) {
    const owner = liveNodeId(dv) || actorKey(dv);
    if (owner) return `map-entity:${owner}`;
  }
  return safeStr(
    dv?.attrs?.source?.dvId || dv?.id,
    `${kind}:${coords.lat}:${coords.lng}`,
  );
}

function isDeliveryIntent(dv) {
  return (
    dv?.kind === "delivery.request" ||
    dv?.kind === "delivery.intent" ||
    (dv?.kind === "work.intent" &&
      (safeStr(dv?.attrs?.domain) === "logistics.delivery" ||
        hasTrait(dv, "falcon:delivery")))
  );
}

function isDeliveryOffer(dv) {
  return (
    dv?.kind === "capability.offer" &&
    (hasTrait(dv, "falcon:available") ||
      hasTrait(dv, "logistics.delivery"))
  );
}

function isDeliveryActivity(dv) {
  return dv?.kind === "delivery.assignment" || dv?.kind === "delivery.status";
}

function isResonanceFrequency(dv) {
  return (
    dv?.kind === "presence.signal" &&
    (dv?.attrs?.frequency?.protocol === "utopy.resonance/1" ||
      hasTrait(dv, "resonance:frequency"))
  );
}

function isCircularResonanceIntent(dv) {
  if (!dv?.attrs?.intent) return false;
  if (safeStr(dv?.meta?.ns).toLowerCase() !== "utopy:resonance") return false;

  // La señal es semántica y abierta: no exige categorías o profesiones
  // predefinidas para existir en el Mapa Vivo.
  return true;
}

function makePoint(kind, dv, threadIndex) {
  const rawCoords = getCoords(dv);
  if (!rawCoords) return null;
  const coords = rawCoords;

  const rawTime = dv?.meta?.updatedAt || dv?.meta?.ts || dv?.attrs?.updatedAt || dv?.attrs?.ts;
  const timestamp = typeof rawTime === "number" ? rawTime : Date.parse(String(rawTime || ""));
  const needsResponse = /demand|need|work\.intent|delivery\.intent|resonance\.need/.test(kind);
  const recent = Number.isFinite(timestamp) && Date.now() - timestamp < 1000 * 60 * 20;

  return {
    id: mapEntityId(kind, dv, coords),
    kind,
    title: getTitleForPoint(dv),
    subtitle: getSubtitleForPoint(dv),
    materialKey: getMaterialKey(dv),
    materialName: getMaterialName(dv),
    quantity: getQuantity(dv),
    unit: getUnit(dv),
    lat: coords.lat,
    lng: coords.lng,
    orgId: getOrgId(dv) || null,
    territoryId: getTerritoryId(dv) || null,
    threadId: inheritedThreadId(dv, threadIndex) || null,
    chainId: safeStr(dv?.attrs?.chainId || dv?.meta?.chainId) || null,
    domain: safeStr(dv?.attrs?.domain || "") || null,
    resonance: isCircularResonanceIntent(dv) || isResonanceFrequency(dv),
    active: isCircularResonanceIntent(dv) || isResonanceFrequency(dv) || (needsResponse && recent),
    needsResponse,
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    signature: safeStr(dv?.attrs?.frequency?.signature || "") || null,
    sourceDvId: safeStr(dv?.attrs?.source?.dvId || dv?.id) || null,
    raw: dv,
  };
}

function makeLinkedPoint(kind, dv, dvById, threadIndex) {
  const linkedId = safeStr(
    dv?.attrs?.deliveryIntentId ||
      dv?.attrs?.delivery?.intentId ||
      dv?.attrs?.target?.id ||
      dv?.attrs?.respondsTo ||
      dv?.meta?.respondsTo
  );
  const linked = dvById.get(linkedId);
  if (!linked) return makePoint(kind, dv, threadIndex);

  const linkedAttrs = linked?.attrs || {};
  const ownAttrs = dv?.attrs || {};

  return makePoint(kind, {
    ...dv,
    attrs: {
      ...linkedAttrs,
      ...ownAttrs,
      title:
        ownAttrs.title ||
        (kind === "delivery.status"
          ? `Entrega · ${safeStr(ownAttrs.state || "en curso")}`
          : linkedAttrs.title),
      geo: ownAttrs.geo || linkedAttrs.geo || null,
      location: ownAttrs.location || linkedAttrs.location || null,
      lat: ownAttrs.lat ?? linkedAttrs.lat,
      lng: ownAttrs.lng ?? linkedAttrs.lng,
      threadId: ownAttrs.threadId || linkedAttrs.threadId,
    },
    meta: {
      ...(linked?.meta || {}),
      ...(dv?.meta || {}),
    },
  }, threadIndex);
}

export function projectMapEntities(allLive, relationsLive = allLive) {
  const map = new Map();
  const productsByNode = new Map();
  const frequencies = [];
  const threadIndex = threadIndexOf(relationsLive);
  const dvById = new Map(
    (allLive || []).filter((dv) => dv?.id).map((dv) => [safeStr(dv.id), dv])
  );

  for (const dv of allLive || []) {
    if (isExpired(dv)) continue;
    if (isResonanceFrequency(dv)) {
      frequencies.push(dv);
      continue;
    }

    const discoverableDV = isPublicLivingComposition(dv) ? compositionAsDiscoveryIntent(dv) : dv;
    const rawKind = safeStr(discoverableDV?.kind).toLowerCase();
    if (/product|producto|mt:producto/.test(rawKind)) {
      const nodeKey = liveNodeId(dv);
      const coordinates = getCoords(dv);
      if (nodeKey && coordinates) {
        const current = productsByNode.get(nodeKey) || { dv, count: 0 };
        current.count += 1;
        current.dv = current.dv || dv;
        productsByNode.set(nodeKey, current);
      }
      continue;
    }

    let point = null;

    if (isPublicLivingComposition(discoverableDV)) point = makePoint("composition", discoverableDV, threadIndex);
    else if (discoverableDV?.kind === "waste.offer") point = makePoint("waste.offer", discoverableDV, threadIndex);
    else if (discoverableDV?.kind === "urban.mining.lot") point = makePoint("urban.mining.lot", discoverableDV, threadIndex);
    else if (discoverableDV?.kind === "material.recovered") point = makePoint("material.recovered", discoverableDV, threadIndex);
    else if (isDeliveryIntent(discoverableDV)) point = makePoint("delivery.intent", discoverableDV, threadIndex);
    else if (isDeliveryOffer(discoverableDV)) point = makeLinkedPoint("delivery.offer", discoverableDV, dvById, threadIndex);
    else if (isDeliveryActivity(discoverableDV)) point = makeLinkedPoint(discoverableDV.kind, discoverableDV, dvById, threadIndex);
    else if (isCircularWork(discoverableDV)) point = makePoint("work.intent", discoverableDV, threadIndex);
    else if (isCircularDemand(discoverableDV)) point = makePoint("mt:demand.material", discoverableDV, threadIndex);
    else if (isCircularOffer(discoverableDV)) point = makePoint("mt:offer", discoverableDV, threadIndex);
    else if (isCircularResonanceIntent(discoverableDV)) {
      const mode = safeStr(discoverableDV?.attrs?.intent?.mode).toLowerCase();
      point = makePoint(
        discoverableDV?.attrs?.interactionRole === "signal" || mode === "discover"
          ? "resonance.signal"
          : mode === "need"
          ? "resonance.need"
          : "resonance.offer",
        discoverableDV,
        threadIndex
      );
    } else if (discoverableDV?.kind === "presence.signal") point = makePoint("person.available", discoverableDV, threadIndex);
    else if (/manifest|node|organization/.test(safeStr(discoverableDV?.kind).toLowerCase())) point = makePoint("node", discoverableDV, threadIndex);
    else if (/capability|service/.test(safeStr(discoverableDV?.kind).toLowerCase())) point = makePoint("capability", discoverableDV, threadIndex);
    else if (/property|realestate|propiedad/.test(safeStr(discoverableDV?.kind).toLowerCase())) point = makePoint("property", discoverableDV, threadIndex);
    else if (/finance|credit/.test(safeStr(discoverableDV?.kind).toLowerCase())) point = makePoint("finance", discoverableDV, threadIndex);
    if (point) {
      const previous = map.get(point.id);
      map.set(
        point.id,
        previous
          ? {
              ...point,
              ...previous,
              resonance: previous.resonance || point.resonance,
              signature: previous.signature || point.signature,
            }
          : point
      );
    }
  }

  for (const [nodeKey, group] of productsByNode.entries()) {
    const point = makePoint(
      "node",
      {
        ...group.dv,
        id: `market-node:${nodeKey}`,
        attrs: {
          ...(group.dv?.attrs || {}),
          title: resolveLiveSeller(group.dv, relationsLive),
          description: `${group.count} ${group.count === 1 ? "oferta disponible" : "ofertas disponibles"}`,
          productCount: group.count,
        },
      },
      threadIndex,
    );
    if (point) {
      const previous = map.get(point.id);
      map.set(
        point.id,
        previous
          ? {
              ...point,
              ...previous,
              subtitle: point.subtitle || previous.subtitle,
              productCount: group.count,
            }
          : point,
      );
    }
  }

  for (const frequency of frequencies) {
    const targetId = safeStr(
      frequency?.attrs?.target?.id || frequency?.attrs?.source?.dvId
    );
    const targetDV = dvById.get(targetId);
    const canonicalTargetId = safeStr(
      targetDV?.attrs?.source?.dvId || targetId
    );
    const existing = map.get(canonicalTargetId) || map.get(targetId);

    if (existing) {
      map.set(existing.id, {
        ...existing,
        resonance: true,
        signature:
          safeStr(frequency?.attrs?.frequency?.signature) || existing.signature,
      });
      continue;
    }

    if (safeStr(frequency?.attrs?.scope) === "circular") {
      const point = makePoint("resonance.frequency", frequency, threadIndex);
      if (point) map.set(point.id, point);
    }
  }

  return Array.from(map.values());
}

// Compatibilidad para consumidores anteriores. La implementación canónica
// es projectMapEntities: solo proyecta entidades territoriales relevantes.
export const collectCircularPoints = projectMapEntities;

function capabilityName(dv, networkLive = []) {
  const seller = resolveLiveSeller(dv, networkLive);
  return seller !== "Nodo vendedor" && !/^(utopy\.node|store:|did:|[a-f0-9-]{24,})/i.test(seller)
    ? humanVisibleText(seller, "Ayuda disponible")
    : humanVisibleText(dv?.attrs?.actorName || dv?.attrs?.actor?.name || dv?.attrs?.node?.name || dv?.attrs?.nodeName || dv?.labels?.[0], "Ayuda disponible");
}

function capabilityLabel(capability) {
  const resource = humanVisibleText(capability?.resources?.[0] || capability?.accepts?.[0], "");
  const verbs = (capability?.verbs || []).map((value) => safeStr(value).toLowerCase());
  if (verbs.some((value) => /transport|deliver|entrega/.test(value))) return "Puede transportar";
  const candidate = humanVisibleText(capability?.label || capability?.name, "");
  return resource
    ? `Puede ayudarte con ${resource}`
    : candidate && !/^(cap|mt|work|utopy)[:.]/i.test(candidate)
      ? candidate
      : "Puede ayudarte con esto";
}

function concreteSemanticMatches(point, networkLive) {
  const intent = point?.raw?.attrs?.intent || {};
  const stop = new Set(["necesito", "quiero", "algo", "para", "con", "una", "uno", "the", "and", "need"]);
  const wanted = [
    ...(intent.resources || []),
    ...(intent.domains || []),
    point?.materialName,
    point?.title,
  ]
    .flatMap((value) => normKey(value).split(/[^a-z0-9]+/))
    .filter((value) => value.length >= 3 && !stop.has(value));
  if (!wanted.length) return [];

  const threadIndex = threadIndexOf(networkLive);
  return (networkLive || [])
    .filter((dv) => {
      const kind = safeStr(dv?.kind).toLowerCase();
      if (/catalog\.source|manifest|falcon\.selection/.test(kind)) return false;
      if (!/product|producto|offer|material|capability|service|work\.cell|person|profile|delivery/.test(kind)) return false;
      const capabilities = Array.isArray(dv?.attrs?.capabilities) ? dv.attrs.capabilities : [];
      const blob = normKey([
        liveTitle(dv),
        dv?.attrs?.description,
        dv?.attrs?.category,
        dv?.attrs?.categoria,
        dv?.attrs?.materialName,
        ...(dv?.labels || []),
        ...capabilities.flatMap((capability) => [capability?.label, capability?.name, ...(capability?.resources || []), ...(capability?.accepts || [])]),
      ].filter(Boolean).join(" "));
      return wanted.some((term) => blob.includes(term));
    })
    .slice(0, 4)
    .map((dv) => ({
      id: safeStr(dv?.id),
      name: capabilityName(dv, networkLive),
      label: /delivery|transport|logistic/.test(safeStr(dv?.kind).toLowerCase())
        ? "Puede transportar"
        : /material/.test(safeStr(dv?.kind).toLowerCase())
          ? "Material disponible"
          : "Relacionado con tu búsqueda",
      distanceKm: null,
      point: looseNetworkPoint(dv, threadIndex),
    }));
}

function liveMatchesForPoint(point, networkLive) {
  const compositionMatches = isPublicLivingComposition(point?.raw)
    ? matchLivingCompositionCandidates(point.raw, networkLive).slice(0, 4).map((match) => ({
        id: safeStr(match.candidate?.id),
        name: capabilityName(match.candidate, networkLive),
        label: match.label,
        score: Math.round(match.score * 100),
        distanceKm: null,
        point: looseNetworkPoint(match.candidate, threadIndexOf(networkLive)),
      }))
    : [];
  const discoveryPoint = isPublicLivingComposition(point?.raw) ? { ...point, raw: compositionAsDiscoveryIntent(point.raw) } : point;
  if (!discoveryPoint?.raw?.attrs?.intent) return compositionMatches;
  const capabilityDVs = (networkLive || []).filter(
    (dv) =>
      dv?.kind !== "catalog.source" &&
      (Array.isArray(dv?.attrs?.capabilities) || dv?.attrs?.capability)
  );
  const threadIndex = threadIndexOf(networkLive);
  const capabilityMatches = matchIntentWithCapabilities(discoveryPoint.raw, capabilityDVs, { minScore: 0.25 })
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 4)
    .map((match) => ({
      id: safeStr(match?.capabilityDV?.id || match?.capability?.id),
      name: capabilityName(match.capabilityDV, networkLive),
      label: capabilityLabel(match.capability),
      score: Math.round(Number(match.score || 0) * 100),
      distanceKm: match.distanceKm,
      point: makePoint("capability", match.capabilityDV, threadIndex),
    }));
  const seen = new Set(compositionMatches.map((match) => match.id));
  const combined = [...compositionMatches, ...capabilityMatches.filter((match) => !seen.has(match.id))];
  combined.forEach((match) => seen.add(match.id));
  return [...combined, ...concreteSemanticMatches(discoveryPoint, networkLive).filter((match) => !seen.has(match.id))].slice(0, 4);
}

function networkKind(dv) {
  const kind = safeStr(dv?.kind).toLowerCase();
  if (kind === "composition.publish") return "composition";
  if (/resonance\.intent|work\.intent|need|demand/.test(kind)) return "resonance.need";
  if (/capability|service/.test(kind)) return "capability";
  if (/person|profile|presence/.test(kind)) return "person.available";
  if (/offer|product|producto/.test(kind)) return "node";
  return "node";
}

function looseNetworkPoint(dv, threadIndex) {
  return makePoint(networkKind(dv), dv, threadIndex) || {
    id: safeStr(dv?.id, `network:${Date.now()}`),
    kind: networkKind(dv),
    title: getTitleForPoint(dv),
    subtitle: getSubtitleForPoint(dv),
    materialKey: getMaterialKey(dv),
    materialName: getMaterialName(dv),
    quantity: getQuantity(dv),
    unit: getUnit(dv),
    productCount: Number(dv?.attrs?.productCount || 0),
    lat: null,
    lng: null,
    threadId: inheritedThreadId(dv, threadIndex) || null,
    chainId: safeStr(dv?.attrs?.chainId || dv?.meta?.chainId) || null,
    raw: dv,
  };
}

function buildNetworkSearchIndex(networkLive) {
  const threadIndex = threadIndexOf(networkLive);
  const seen = new Set();
  return (networkLive || [])
    .filter((dv) => {
      if (!dv || isExpired(dv)) return false;
      const kind = safeStr(dv?.kind).toLowerCase();
      return /composition\.publish|capability|manifest|organization|person|presence|offer|product|producto|material|work\.intent|resonance\.intent|demand|delivery|property|realestate|finance|credit/.test(kind);
    })
    .flatMap((dv) => {
      const point = looseNetworkPoint(dv, threadIndex);
      if (seen.has(point.id)) return [];
      seen.add(point.id);
      const capabilities = Array.isArray(dv?.attrs?.capabilities)
        ? dv.attrs.capabilities.flatMap((capability) => [
          capability?.id,
            capability?.code,
            capability?.label,
            ...(capability?.traits || []),
            ...(capability?.domains || []),
            ...(capability?.resources || []),
            ...(capability?.accepts || []),
          ])
        : [];
      const blob = normKey([
        dv?.kind,
        dv?.attrs?.title,
        dv?.attrs?.name,
        dv?.attrs?.nombre,
        dv?.attrs?.description,
        dv?.attrs?.intent?.summary,
        dv?.attrs?.node?.name,
        dv?.attrs?.nodeName,
        dv?.attrs?.materialName,
        ...(Array.isArray(dv?.labels) ? dv.labels : []),
        ...(Array.isArray(dv?.traits) ? dv.traits : []),
        ...capabilities,
      ].map((value) => safeStr(value)).join(" "));
      const rank = /capability|manifest|organization|person|presence/.test(safeStr(dv?.kind).toLowerCase()) ? 0 : 1;
      return [{ point, blob, rank }];
    });
}

function searchNetworkIndex(index, query) {
  const needle = normKey(query);
  if (needle.length < 2) return [];
  return index
    .filter((entry) => entry.blob.includes(needle))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5)
    .map((entry) => entry.point);
}

function iconTone(kind) {
  switch (kind) {
    case "waste.offer":
      return { bg: "#15ff00", glow: "rgba(21,255,0,.34)", emoji: "♻️" };
    case "urban.mining.lot":
      return { bg: "#a78bfa", glow: "rgba(167,139,250,.34)", emoji: "🧲" };
    case "material.recovered":
      return { bg: "#67e8f9", glow: "rgba(103,232,249,.34)", emoji: "🧱" };
    case "work.intent":
      return { bg: "#facc15", glow: "rgba(250,204,21,.34)", emoji: "🛠️" };
    case "person.available":
      return { bg: "#fde68a", glow: "rgba(253,230,138,.4)", emoji: "🧑‍🔧" };
    case "node":
      return { bg: "#86efac", glow: "rgba(134,239,172,.4)", emoji: "🏪" };
    case "capability":
      return { bg: "#fcd34d", glow: "rgba(252,211,77,.4)", emoji: "🛠" };
    case "property":
      return { bg: "#c4b5fd", glow: "rgba(196,181,253,.4)", emoji: "🏠" };
    case "finance":
      return { bg: "#93c5fd", glow: "rgba(147,197,253,.4)", emoji: "💳" };
    case "delivery.intent":
      return { bg: "#22d3ee", glow: "rgba(34,211,238,.4)", emoji: "🚚" };
    case "delivery.offer":
      return { bg: "#38bdf8", glow: "rgba(56,189,248,.42)", emoji: "🛵" };
    case "delivery.assignment":
      return { bg: "#60a5fa", glow: "rgba(96,165,250,.42)", emoji: "📍" };
    case "delivery.status":
      return { bg: "#2dd4bf", glow: "rgba(45,212,191,.44)", emoji: "➜" };
    case "mt:demand.material":
      return { bg: "#fb7185", glow: "rgba(251,113,133,.34)", emoji: "📥" };
    case "resonance.need":
      return { bg: "#9f8cff", glow: "rgba(159,140,255,.42)", emoji: "◌" };
    case "resonance.offer":
      return { bg: "#7edbc2", glow: "rgba(126,219,194,.42)", emoji: "✦" };
    case "resonance.frequency":
      return { bg: "#73b9ff", glow: "rgba(115,185,255,.44)", emoji: "⌁" };
    default:
      return { bg: "#93c5fd", glow: "rgba(147,197,253,.34)", emoji: "📦" };
  }
}

export default function CircularMapPanel({
  allLive,
  networkLive = allLive,
  onOpenThread,
  onOfferMaterial,
  actorId = "",
  purchaseContext = null,
  onContinuePurchase,
  onOpenProduct,
  focusedId = "",
  overlaySuppressed = false,
  activityRequestKey = 0,
  hideActivityToggle = false,
  initialProjection,
  onReturnToFeed,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [navigation, updateNavigation] = useLivingSpaceNavigation(actorId);
  useEffect(() => {
    if (initialProjection && actorId) updateNavigation({ projection: initialProjection });
  }, [initialProjection, actorId, updateNavigation]);
  const feedElement = useRef(null);
  const rememberedFeedScroll = useRef(navigation.feedScroll);
  const mode = navigation.mode;
  const setMode = (mode) => updateNavigation({ mode });
  const projection = navigation.projection;
  const setProjection = (projection) => {
    if (projection === "feed" && onReturnToFeed) { onReturnToFeed(); return; }
    updateNavigation({ projection });
  };
  useEffect(() => {
    if (projection === "feed" && feedElement.current) feedElement.current.scrollTop = rememberedFeedScroll.current;
    return () => { updateNavigation({ feedScroll: rememberedFeedScroll.current }); };
  }, [projection, updateNavigation]);
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("projection");
    if (["feed", "orbit", "map"].includes(requested)) updateNavigation({ projection: requested });
  }, [location.search, updateNavigation]);
  const geographic = projection === "map";
  const query = navigation.query;
  const setQuery = (query) => updateNavigation({ query, exploreAll: false });
  const voice = useContextualVoice((text) => {
    const command = interpretSpaceCommand(text);
    if (command.projection) setProjection(command.projection);
    else if (command.create) navigate("/market?tab=producir");
    else setQuery(command.query ?? text);
  });
  const [deferredQuery, setDeferredQuery] = useState("");
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [pointSheetOpen, setPointSheetOpen] = useState(false);
  const selectPoint = (point) => { setSelectedPoint(point); updateNavigation({ selectedRef: canonicalSpaceRef(point) }); setPointSheetOpen(true); };
  const [activityOpen, setActivityOpen] = useState(false);
  useEffect(() => { if (activityRequestKey) setActivityOpen(true); }, [activityRequestKey]);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  useEffect(() => {
    if (!overlaySuppressed) return;
    setActivityOpen(false);
    setMoreFiltersOpen(false);
    setSelectedPoint(null);
    setPointSheetOpen(false);
  }, [overlaySuppressed]);

  useEffect(() => {
    if (!activityOpen && !moreFiltersOpen && !pointSheetOpen) return;
    const onEscape = (event) => {
      if (event.key !== "Escape") return;
      if (activityOpen) setActivityOpen(false);
      else if (moreFiltersOpen) setMoreFiltersOpen(false);
      else setPointSheetOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [activityOpen, moreFiltersOpen, pointSheetOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDeferredQuery(query), 160);
    return () => window.clearTimeout(timer);
  }, [query]);

  const visibleLive = useMemo(
    () => (allLive || []).filter((dv) => visibleToMapActor(dv, actorId)),
    [allLive, actorId],
  );
  const visibleNetwork = useMemo(
    () => networkLive === allLive
      ? visibleLive
      : (networkLive || []).filter((dv) => visibleToMapActor(dv, actorId)),
    [networkLive, allLive, visibleLive, actorId],
  );
  const livingNodes = useMemo(() => projectLivingNodes(visibleNetwork), [visibleNetwork]);
  const verifiedCapabilities = useLivingCapabilities(visibleNetwork, actorId);
  const capabilityPoints = useMemo(() => verifiedCapabilities.map((envelope) => {
    const node = livingNodes.find((node) => node.nodeId === envelope.authority || node.id === envelope.authority);
    const manifest = envelope.payload;
    return { id: envelope.id, kind: "capability", title: humanVisibleText(manifest.capability.label, "Puede ayudarte"),
      subtitle: node?.name || "Nodo Vivo", raw: { id: envelope.id, kind: envelope.kind, attrs: { nodeId: envelope.authority }, meta: { scopes: envelope.scopes } },
      nodeProjection: node, capabilityEnvelope: envelope, lat: node?.presence?.lat, lng: node?.presence?.lng,
      semanticText: [manifest.capability.label, ...manifest.capability.traits, ...manifest.accepts.intentKinds].join(" ") };
  }), [verifiedCapabilities, livingNodes]);
  const ownNode = useMemo(() => livingNodes.find((node) => node.actorId === actorId && !node.nodeId) || livingNodes.find((node) => node.actorId === actorId), [livingNodes, actorId]);
  const origin = useMemo(() => ownNode?.presence ? { attrs: { geo: ownNode.presence, territoryId: ownNode.territory } } : null, [ownNode]);
  const priorThreads = useMemo(() => new Set(visibleNetwork.filter((dv) => actorId && [dv?.attrs?.actorId, dv?.attrs?.buyerActorId, dv?.attrs?.sellerActorId, ...(Array.isArray(dv?.attrs?.participants) ? dv.attrs.participants : [])].some((id) => safeStr(id) === actorId)).map(getThreadId).filter(Boolean)), [visibleNetwork, actorId]);
  const activeIntent = useMemo(() => {
    if (!actorId) return "";
    const latest = visibleLive.filter((dv) =>
      /intent|resonance\.signal|need|demand/.test(safeStr(dv?.kind).toLowerCase()) &&
      [dv?.attrs?.actorId, dv?.attrs?.ownerActorId, dv?.meta?.authority].some((id) => safeStr(id) === actorId) &&
      !/closed|resolved|cancel|expired/i.test(safeStr(dv?.attrs?.status)) && !isExpired(dv)
    ).sort((a, b) => Date.parse(b?.meta?.updatedAt || b?.meta?.ts || 0) - Date.parse(a?.meta?.updatedAt || a?.meta?.ts || 0))[0];
    return latest ? getTitleForPoint(latest) : "";
  }, [visibleLive, actorId]);
  const sceneIntent = navigation.exploreAll ? "" : deferredQuery.trim() || activeIntent;

  const liquidityProximity = useMemo(
    () => projectLiquidityProximity({
      allLive: visibleNetwork,
      actorId: purchaseContext?.buyerActorId || actorId,
      sellerNodeId: purchaseContext?.sellerNodeId || null,
      currency: purchaseContext?.currency || null,
      amount: purchaseContext?.amount || null,
      territory: purchaseContext?.territory || null,
      publicOnly: true,
    }),
    [visibleNetwork, actorId, purchaseContext],
  );
  const liquidityPoints = useMemo(
    () => liquidityProximity.map.map((possibility) => ({
      id: `liquidity:${possibility.id}`,
      kind: ["credit", "route"].includes(possibility.kind) ? "finance" : possibility.kind === "deliver" ? "delivery.offer" : "capability",
      title: possibility.name,
      subtitle: possibility.condition,
      materialName: "",
      quantity: 0,
      unit: "",
      productCount: 0,
      lat: possibility.lat,
      lng: possibility.lng,
      threadId: possibility.source?.attrs?.threadId || possibility.source?.meta?.threadId || null,
      chainId: possibility.source?.attrs?.chainId || possibility.source?.meta?.chainId || null,
      raw: possibility.source,
      liquidity: possibility,
    })),
    [liquidityProximity],
  );

  const points = useMemo(
    () => measureDev("utopy.map.projectMapEntities", () => {
      const projected = projectMapEntities(visibleLive, visibleNetwork);
      const locatedLiquidity = liquidityPoints.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
      const seen = new Set(projected.map((point) => point.id));
      return [...projected, ...locatedLiquidity.filter((point) => !seen.has(point.id))];
    }),
    [visibleLive, visibleNetwork, liquidityPoints]
  );
  const areaPublications = useMemo(() => [...publicLivingSignals(visibleNetwork), ...visibleNetwork.filter(isPublicLivingComposition).map(compositionAsDiscoveryIntent)].filter((dv) =>
    !getCoords(dv) &&
    !/closed|resolved|cancel|expired/i.test(String(dv?.attrs?.status || "")) &&
    (Array.isArray(dv?.meta?.scopes) ? dv.meta.scopes.includes("public") : true) && !isExpired(dv))
    .slice(-80).reverse()
    .map((dv) => ({ id: dv.id, kind: String(dv.kind), title: getTitleForPoint(dv), subtitle: dv?.attrs?.privacyPolicies?.includes?.("noLocationDisclosure") ? "Ubicación privada" : humanVisibleText(dv?.attrs?.territory?.name || dv?.attrs?.expression?.interpretation?.territory, "Sin ubicación compartida"), lat: null, lng: null, raw: dv, threadId: getThreadId(dv), sourceDvId: dv.id }))
    .filter(point => !/^(vos|yo|persona|perfil vivo|publicación viva)$/i.test(point.title.trim()))
    .filter((point, index, items) => items.findIndex(other => other.id === point.id || (actorKey(other.raw) === actorKey(point.raw) && other.kind === point.kind && other.title.trim().toLowerCase() === point.title.trim().toLowerCase())) === index), [visibleNetwork]);

  const activities = useMemo(
    () => measureDev("utopy.map.feedDerivation", () => collectHumanLiveActivity(visibleNetwork, actorId, 24)
      .filter((activity) => {
        if (!actorId) return false;
        const attrs = activity.dv?.attrs || {};
        return activity.own ||
          [attrs.actorId, attrs.buyerActorId, attrs.buyerId, attrs.sellerId, attrs.ownerActorId, attrs.assigneeActorId, attrs.toActorId]
            .some((value) => String(value || "") === actorId) ||
          (Array.isArray(attrs.participants) && attrs.participants.some((value) => String(value) === actorId));
      }).slice(0, 24)),
    [visibleNetwork, actorId],
  );

  const filteredPoints = useMemo(() => {
    return measureDev("utopy.map.filterDerivation", () => points.filter((p) => {
      if (purchaseContext && !p.liquidity) return false;
      const blob = `${p.title} ${p.subtitle} ${p.materialName || ""} ${p.domain || ""} ${p.raw?.attrs?.category || ""}`;
      if (!matchesCircularMode(p, mode, blob)) return false;
      const wanted = semanticWords(sceneIntent);
      if (wanted.length && !wanted.some((word) => semanticWords(blob).join(" ").includes(word))) return false;
      return true;
    }));
  }, [points, mode, sceneIntent, purchaseContext]);

  const feedScene = useMemo(
    () => projectCircularScene(livingNodes, points, [...areaPublications, ...capabilityPoints], liquidityPoints, mode, sceneIntent, purchaseContext, origin, priorThreads, { full: true, productDVs: visibleNetwork }),
    [livingNodes, points, areaPublications, capabilityPoints, liquidityPoints, mode, sceneIntent, purchaseContext, origin, priorThreads, visibleNetwork],
  );
  const circularScene = useMemo(() => {
    const selected = feedScene.find((entry) => canonicalSpaceRef(entry.point) === navigation.selectedRef);
    const entries = feedScene.filter((entry) => !entry.point.product || selected === entry);
    return (selected ? [selected, ...entries.filter((entry) => entry !== selected)] : entries).slice(0, 6);
  }, [feedScene, navigation.selectedRef]);
  const mapPoints = useMemo(() => {
    const located = feedScene.map((entry) => entry.point).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    return selectedPoint && Number.isFinite(selectedPoint.lat) && Number.isFinite(selectedPoint.lng) && !located.some((point) => canonicalSpaceRef(point) === canonicalSpaceRef(selectedPoint)) ? [...located, selectedPoint] : located;
  }, [feedScene, selectedPoint]);
  useEffect(() => {
    if (!navigation.selectedRef || overlaySuppressed) return;
    const match = feedScene.find((entry) => canonicalSpaceRef(entry.point) === navigation.selectedRef)?.point;
    if (match) setSelectedPoint(match);
  }, [navigation.selectedRef, feedScene, overlaySuppressed]);
  const sceneRelationships = useMemo(() => circularScene.flatMap((entry, index) => circularScene.slice(index + 1).flatMap((other, offset) => {
    const sharedThread = entry.point.threadId && entry.point.threadId === other.point.threadId;
    const sharedChain = entry.point.chainId && entry.point.chainId === other.point.chainId;
    if (!sharedThread && !sharedChain) return [];
    return [{ from: index, to: index + offset + 1, key: `${entry.point.id}:${other.point.id}` }];
  })).slice(0, 4), [circularScene]);

  useEffect(() => {
    if (!focusedId || selectedPoint || overlaySuppressed) return;
    const wanted = String(focusedId).toLowerCase();
    const match = [...circularScene.map((entry) => entry.point), ...points, ...areaPublications].find((point) => [point.id, point.nodeProjection?.id, liveNodeId(point.raw), point.raw?.id].some((value) => String(value || "").toLowerCase() === wanted));
    if (match) selectPoint(match);
  }, [focusedId, circularScene, points, areaPublications, selectedPoint, overlaySuppressed]);

  const linkedPoints = useMemo(() => {
    if (!selectedPoint) return [];
    return filteredPoints.filter((point) => point.id !== selectedPoint.id &&
      ((selectedPoint.threadId && point.threadId === selectedPoint.threadId) ||
       (selectedPoint.chainId && point.chainId === selectedPoint.chainId) ||
       (selectedPoint.materialKey && point.materialKey === selectedPoint.materialKey))).slice(0, 4);
  }, [selectedPoint, filteredPoints]);

  const liveMatches = useMemo(
    () => liveMatchesForPoint(selectedPoint, visibleNetwork),
    [selectedPoint, visibleNetwork]
  );
  const compositeCoverage = useMemo(() => {
    if (!selectedPoint || liveMatches.length < 2) return null;
    const target = Number(selectedPoint.quantity || 0);
    const amounts = liveMatches
      .map((match) => Number(match?.point?.quantity || 0))
      .filter((amount) => Number.isFinite(amount) && amount > 0);
    const potential = amounts.reduce((sum, amount) => sum + amount, 0);
    return {
      providers: liveMatches.length,
      target,
      potential,
      canCover: target > 0 && potential >= target,
    };
  }, [selectedPoint, liveMatches]);
  const networkSearchIndex = useMemo(
    () => buildNetworkSearchIndex(visibleNetwork),
    [visibleNetwork],
  );
  const networkResults = useMemo(
    () => searchNetworkIndex(networkSearchIndex, deferredQuery),
    [networkSearchIndex, deferredQuery]
  );
  useEffect(() => {
    if (!networkResults.length) return;
    const onEscape = (event) => { if (event.key === "Escape") setQuery(""); };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [networkResults.length]);
  const selectedHasCoords = Number.isFinite(selectedPoint?.lat) && Number.isFinite(selectedPoint?.lng);
  const selectedDistanceKm = selectedHasCoords && origin ? distanceKmBetween(origin, selectedPoint) : null;
  const selectedIsProduct = /product|producto/.test(safeStr(selectedPoint?.raw?.kind).toLowerCase());
  const selectedIsWorkOpportunity = /work\.intent|resonance\.intent/.test(safeStr(selectedPoint?.raw?.kind).toLowerCase()) && /trabaj|empleo|meser|niñer|niner|cuidad|ayuda/i.test(safeStr(selectedPoint?.title));
  const selectedNodeProducts = useMemo(() => {
    if (selectedPoint?.kind !== "node") return [];
    if (selectedPoint.nodeProjection) return selectedPoint.nodeProjection.products
      .filter((product) => product.available && product.source)
      .map((product) => product.source)
      .slice(0, 8);
    const nodeId = liveNodeId(selectedPoint.raw);
    if (!nodeId) return [];
    return visibleNetwork
      .filter((dv) => {
        if (!/product|producto/.test(safeStr(dv?.kind).toLowerCase())) return false;
        if (liveNodeId(dv) !== nodeId) return false;
        const stock = Number(dv?.attrs?.stockQty ?? dv?.attrs?.stock);
        return dv?.attrs?.available !== false && (!Number.isFinite(stock) || stock > 0);
      })
      .slice(0, 8);
  }, [selectedPoint, visibleNetwork]);

  const openActivity = (activity) => {
    const point = points.find(
      (candidate) =>
        candidate.sourceDvId === activity.dv?.id || candidate.raw?.id === activity.dv?.id,
    );
    if (point) selectPoint(point);
    else {
      const threadId = getThreadId(activity.dv);
      if (threadId) onOpenThread?.(threadId, activity.dv);
    }
    setActivityOpen(false);
  };

  const humanPointType = (point) => {
    if (point.kind === "person.available") return "Persona disponible · cerca";
    if (point.kind === "node") return "Comercio o nodo · cerca";
    if (point.kind === "capability") return "Puede ayudar · cerca";
    if (point.kind === "property") return "Espacio · en la zona";
    if (point.kind === "finance") return "Puede financiar";
    if (point.kind.includes("delivery")) return "Entrega o transporte";
    if (/demand|need|intent/.test(point.kind)) return `Necesita ${point.materialName || "ayuda"}`;
    return point.materialName ? `${point.materialName} disponible` : "Señal viva cerca";
  };

  return (
    <Wrap>
      <Shell>
        {!hideActivityToggle ? <ActivityToggle
          type="button"
          onClick={() => setActivityOpen((current) => !current)}
          aria-expanded={activityOpen}
          aria-label="Actividad"
          title="Actividad"
        >
          <Activity />
        </ActivityToggle> : null}
        {activityOpen ? (
          <ActivitySheet role="dialog" aria-label="Actividad viva reciente">
            <header>
              <div>
                <b>Actividad</b>
              </div>
              <button type="button" onClick={() => setActivityOpen(false)} aria-label="Cerrar">×</button>
            </header>
            <div className="feed">
              {activities.length ? activities.map((activity) => (
                <button
                  className="activity"
                  type="button"
                  key={activity.id}
                  onClick={() => openActivity(activity)}
                >
                  <span className="icon">{activity.icon}</span>
                  <span className="copy">
                    <b>{/^(trade|market\.order)\.message$/.test(String(activity.dv?.kind || "")) ? "💬 Conversación" : `${activity.own ? "Tu actividad · " : ""}${activity.title}`}</b>
                    <small>{/^(trade|market\.order)\.message$/.test(String(activity.dv?.kind || "")) ? String(activity.dv?.attrs?.text || "Mensaje nuevo").slice(0, 90) : activity.detail}</small>
                  </span>
                  <time>{activity.time}</time>
                </button>
              )) : <div className="empty">Todavía no hay novedades para vos.</div>}
            </div>
          </ActivitySheet>
        ) : null}
        <MapSearch><Search aria-hidden="true" /><input aria-label="Buscar en el Mapa Vivo" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { const command = interpretSpaceCommand(query); if (command.projection) { setProjection(command.projection); setQuery(""); } } }} placeholder="¿Qué necesitás?" /><button type="button" aria-label={voice.listening ? "Dejar de escuchar" : "Expresar intención por voz"} aria-pressed={voice.listening} onClick={voice.start}><Mic/></button></MapSearch>
        {networkResults.length ? <SearchResults>{networkResults.map((point) => <button type="button" key={point.id} onClick={() => { selectPoint(point); setQuery(""); }}><div><b>{iconTone(point.kind).emoji} {point.title}</b><span>{humanPointType(point)}</span></div><span>{Number.isFinite(point.lat) ? "En el mapa" : "En la red"}</span></button>)}</SearchResults> : null}

        {projection === "feed" && onReturnToFeed ? <MapLoading role="status">Abriendo tu feed…</MapLoading> : geographic ? <Suspense fallback={<MapLoading>Abriendo mapa geográfico…</MapLoading>}><CircularGeographicMap points={mapPoints} selected={selectedPoint} linkedPoints={linkedPoints} liveMatches={liveMatches} onSelect={selectPoint} overlaySuppressed={overlaySuppressed} origin={origin?.attrs?.geo} /></Suspense> : projection === "feed" ? <FeedScene ref={feedElement} onScroll={(event) => { rememberedFeedScroll.current = event.currentTarget.scrollTop; }} aria-label="Feed vivo">
          <div className="feed-heading"><div><h2>{sceneIntent ? "Para lo que buscás" : "Descubrí tu red"}</h2><p>{deferredQuery ? "Según lo que escribiste" : activeIntent && !navigation.exploreAll ? "Según tu necesidad publicada" : "Exploración libre · personas, lugares y capacidades"}</p>{voice.notice ? <p role="status">{voice.notice}</p> : null}</div><button type="button" className="feed-count" onClick={() => updateNavigation({ query: "", mode: "all", exploreAll: true })}>Explorar todo</button></div>
          {feedScene.length ? <div className="feed-grid" data-sparse={feedScene.length === 1}>{feedScene.map((entry) => {
            const image = entry.point.product ? resolveLiveImage(entry.point.raw, visibleNetwork) || entry.point.product.image : entry.point.nodeProjection?.avatarRef || resolveLiveImage(entry.point.raw, visibleNetwork);
            return <button key={entry.point.id} type="button" aria-pressed={selectedPoint?.id === entry.point.id} onClick={() => selectPoint(entry.point)}><span className="feed-avatar">{image ? <img loading="lazy" decoding="async" src={image} alt="" /> : iconTone(entry.point.kind).emoji}</span><span className="feed-copy"><b>{entry.point.title}</b><small>{entry.point.subtitle || "Nodo Vivo"}</small><em>{entry.distanceKm != null ? `Aprox. ${entry.distanceKm.toFixed(1)} km · ` : ""}{entry.point.product?.finalPrice ? new Intl.NumberFormat("es-PY", { style: "currency", currency: entry.point.product.currency || "PYG", maximumFractionDigits: 0 }).format(entry.point.product.finalPrice) : entry.point.product ? "Ver producto" : "Conocer más"} →</em></span></button>;
          })}</div> : <p>No hay opciones para este contexto todavía.</p>}
        </FeedScene> : <CircularScene aria-label="Red circular viva">
          <SceneRing className="ring-one" /><SceneRing className="ring-two" /><SceneRing className="ring-three" />
          <SceneLinks viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {(sceneIntent || purchaseContext) ? circularScene.map((entry, index) => <line key={entry.point.id} x1="50" y1="50" x2={CIRCULAR_SLOTS[index].x} y2={CIRCULAR_SLOTS[index].y} className={/assignment|status/.test(entry.point.kind) ? "active" : /schedule|program/.test(entry.point.kind) ? "scheduled" : "suggested"} />) : null}
            {sceneRelationships.map((edge) => <line key={edge.key} x1={CIRCULAR_SLOTS[edge.from].x} y1={CIRCULAR_SLOTS[edge.from].y} x2={CIRCULAR_SLOTS[edge.to].x} y2={CIRCULAR_SLOTS[edge.to].y} className="related" />)}
          </SceneLinks>
          <SceneCenter><span>Tu intención</span><strong>{sceneIntent || (purchaseContext ? "Completar esta compra" : "¿Qué necesitás?")}</strong><small>{sceneIntent ? `${circularScene.length} ${circularScene.length === 1 ? "posibilidad" : "posibilidades"} en tu red` : "La red se organiza alrededor de vos"}</small></SceneCenter>
          {circularScene.map((entry, index) => <SceneNode key={entry.point.id} type="button" aria-pressed={selectedPoint?.id === entry.point.id} style={{ "--scene-x": `${CIRCULAR_SLOTS[index].x}%`, "--scene-y": `${CIRCULAR_SLOTS[index].y}%` }} onClick={() => selectPoint(entry.point)}>
            <span className={`scene-symbol domain-${entry.domain}`}>{entry.point.nodeProjection?.avatarRef ? <img loading="lazy" decoding="async" src={entry.point.nodeProjection.avatarRef} alt="" /> : iconTone(entry.point.kind).emoji}</span>
            <span className="scene-copy"><b>{entry.point.title}</b><small>{publishedEtaMinutes(entry.point) != null ? `Entrega ${publishedEtaMinutes(entry.point)} min` : entry.point.nodeProjection?.availability?.availableNow ? "Disponible ahora" : entry.distanceKm != null ? `Aprox. ${entry.distanceKm.toFixed(1)} km` : entry.point.subtitle || { finance: "Financiación", delivery: "Entrega", production: "Producción", spaces: "Espacios" }[entry.domain] || "Nodo Vivo"}</small></span>
          </SceneNode>)}
          {!circularScene.length ? <SceneEmpty>{sceneIntent ? "No encontramos una opción para esa intención todavía." : "Tu red aparecerá acá cuando los nodos publiquen sus capacidades."}</SceneEmpty> : null}
        </CircularScene>}

        <Vignette />

        {(activityOpen || moreFiltersOpen || pointSheetOpen || networkResults.length > 0) ? <LivingModalBackdrop $level={pointSheetOpen ? 790 : activityOpen || moreFiltersOpen ? 535 : 528} onClick={() => {
          if (activityOpen) setActivityOpen(false);
          else if (moreFiltersOpen) setMoreFiltersOpen(false);
          else if (pointSheetOpen) setPointSheetOpen(false);
          else setQuery("");
        }} aria-hidden="true" /> : null}

        {geographic && liquidityPoints.length ? <LiquidityRail aria-label="Posibilidades de la red viva">
          {liquidityPoints.slice(0, 3).map((point) => <button type="button" key={point.id} onClick={() => selectPoint(point)}><b>💧 Puede ayudar con esta compra</b><span>{point.title} · {point.subtitle}</span></button>)}
        </LiquidityRail> : null}
        {geographic && !purchaseContext && areaPublications.length ? <MapPublicationRail aria-label="Publicaciones sin ubicación"><summary aria-label={`${areaPublications.length} publicaciones en la red sin ubicación`} title="Publicaciones en la red sin ubicación"><span aria-hidden="true">⌘</span><sup>{areaPublications.length}</sup></summary><div>{areaPublications.slice(0, 12).map((point) => <button type="button" key={point.id} onClick={() => selectPoint(point)}><b>{point.title}</b><span>{point.subtitle}</span></button>)}</div></MapPublicationRail> : null}

        {pointSheetOpen && selectedPoint ? <PointSheet role="dialog" aria-modal="true" aria-label={selectedPoint.title} data-point-sheet>
          <button type="button" className="close" onClick={() => setPointSheetOpen(false)} aria-label="Cerrar detalle">×</button>
          <div className="point-body">
          <div className="eyebrow">{humanPointType(selectedPoint)}</div>
          <h3>{iconTone(selectedPoint.kind).emoji} {selectedPoint.title}</h3>
          {selectedPoint.subtitle ? <p>{selectedPoint.subtitle}</p> : null}
          {selectedPoint.capabilityEnvelope ? <LivingCapabilityDetails envelope={selectedPoint.capabilityEnvelope} allLive={visibleNetwork} /> : null}
          {publishedEtaMinutes(selectedPoint) != null ? <p>Entrega estimada: {publishedEtaMinutes(selectedPoint)} min</p> : null}
          {selectedDistanceKm != null ? <p>📍 Aprox. {selectedDistanceKm.toFixed(1)} km desde tu zona</p> : null}
          {selectedPoint.quantity > 0 ? <strong>{selectedPoint.quantity} {selectedPoint.unit}</strong> : null}
          {selectedPoint.productCount > 0 ? <strong>{selectedPoint.productCount} {selectedPoint.productCount === 1 ? "oferta viva" : "ofertas vivas"}</strong> : null}
          {selectedPoint.liquidity ? <CompositeHint>{selectedPoint.liquidity.title}<br />{selectedPoint.liquidity.condition}</CompositeHint> : null}
          {selectedNodeProducts.length ? <NodeProducts><strong>Productos disponibles</strong>{selectedNodeProducts.map((product) => <button type="button" key={product.id} onClick={() => onOpenProduct?.(product)}><b>{liveTitle(product)}</b><span>Ver</span></button>)}</NodeProducts> : null}
          {compositeCoverage ? <CompositeHint>
            {compositeCoverage.canCover
              ? `${compositeCoverage.providers} aportes podrían cubrir juntos esta necesidad.`
              : `La red puede combinar estas ${compositeCoverage.providers} opciones en una propuesta.`}
            {" "}Cada participante confirma su parte; nada se acepta automáticamente.
          </CompositeHint> : null}
          {liveMatches.length ? <NetworkMatches><strong>Encontramos {liveMatches.length} {liveMatches.length === 1 ? "opción" : "opciones"} que pueden ayudarte</strong>{liveMatches.map((match) => <div className="match" key={match.id}><div><b>{match.name}</b><span>{match.label}{match.distanceKm != null ? ` · ${Number(match.distanceKm).toFixed(1)} km` : ""}</span></div></div>)}</NetworkMatches> : null}
          </div>
          <Row>
            {selectedHasCoords && !geographic ? <Btn $ghost onClick={() => { setProjection("map"); setPointSheetOpen(false); }}>Ver en mapa</Btn> : null}
            {selectedPoint.threadId && !selectedIsWorkOpportunity ? <Btn $ghost onClick={() => onOpenThread?.(selectedPoint.threadId, selectedPoint)}>Hablar</Btn> : null}
            {selectedPoint.raw && (!selectedPoint.capabilityEnvelope || selectedPoint.nodeProjection?.source) ? <Btn $ghost onClick={() => navigate(`/${profileHandleForIdentity(selectedPoint.nodeProjection?.source || selectedPoint.raw, selectedPoint.nodeProjection?.name || selectedPoint.title)}`, { state: { returnTo: `${location.pathname}${location.search}${location.hash}` } })}>Ver perfil</Btn> : null}
            {selectedIsProduct ? <Btn onClick={() => onOpenProduct?.(selectedPoint.raw)}>Ver producto</Btn> : !selectedPoint.capabilityEnvelope ? <Btn onClick={() => selectedIsWorkOpportunity && selectedPoint.threadId ? onOpenThread?.(selectedPoint.threadId, selectedPoint) : selectedPoint.liquidity && onContinuePurchase ? onContinuePurchase(selectedPoint.liquidity) : onOfferMaterial?.(selectedPoint)}>{selectedIsWorkOpportunity && selectedPoint.threadId ? "Me interesa" : selectedPoint.liquidity ? "Continuar compra" : /need|demand|intent|signal/.test(selectedPoint.kind) ? "Puedo aportar" : "Consultar"}</Btn> : null}
          </Row>
        </PointSheet> : null}

        {geographic && !filteredPoints.length ? (
          <EmptyState>
            <EmptyIcon>♻️</EmptyIcon>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Nada por acá</div>
            <Subtle style={{ marginTop: 6, color: "rgba(15,23,42,0.62)" }}>
              Probá otra búsqueda o filtro.
            </Subtle>
          </EmptyState>
        ) : null}

        <ControlDock>
          <ProjectionTabs aria-label="Vista de la red">
            {[["feed", "Feed"], ["orbit", "Órbita"], ["map", "Mapa"]].map(([key, label]) => <button type="button" key={key} aria-pressed={projection === key} onClick={() => { if (key === "feed" && onReturnToFeed) onReturnToFeed(); else setProjection(key); }}>{label}</button>)}
          </ProjectionTabs>
          <FilterPanel>
            {CIRCULAR_MODES.map(([key, label]) => <FilterBtn key={key} type="button" $active={mode === key} onClick={() => setMode(key)}>{label}</FilterBtn>)}
            <FilterBtn type="button" $active={moreFiltersOpen} onClick={() => setMoreFiltersOpen((current) => !current)} aria-expanded={moreFiltersOpen} aria-label="Más filtros"><SlidersHorizontal />Más</FilterBtn>
          </FilterPanel>

        </ControlDock>
        {moreFiltersOpen ? (
          <MoreFiltersSheet role="dialog" aria-label="Más filtros del mapa">
            <header><div><b>Explorar</b></div><button type="button" onClick={() => setMoreFiltersOpen(false)} aria-label="Cerrar">×</button></header>
            <div>
              {[
                ["all", "⌁", "Todo"],
                ["need", "⚡", "Necesitan"],
                ["offer", "✨", "Ofrecen"],
                ["work", "🛠️", "Trabajo"],
                ["delivery", "🚚", "Entregas"],
                ["material", "🪵", "Materiales"],
                ["commerce", "🏪", "Comercios"],
                ["production", "🏭", "Producción"],
                ["finance", "💳", "Financiación"],
                ["spaces", "🏠", "Espacios"],
                ["circular", "♻️", "Circularidad"],
              ].map(([key, icon, label]) => (
                <button type="button" key={key} data-active={mode === key} onClick={() => { setMode(key); setMoreFiltersOpen(false); }}>
                  <span>{icon}</span><b>{label}</b>
                </button>
              ))}
            </div>
          </MoreFiltersSheet>
        ) : null}
      </Shell>
    </Wrap>
  );
}

