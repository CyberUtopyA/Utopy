import { useEffect, useMemo, useState } from "react";
import styled, { keyframes } from "styled-components";
import { ArrowLeft, ArrowRight, ImagePlus, MapPin, Mic, Plus, Sparkles, ShoppingBag, HeartHandshake, Search, Wrench, PenLine, X } from "lucide-react";
import { interpretHumanSignal } from "./interlanguage";
import { projectLivingNodes } from "../utopy/livingNodeProjection";
import { humanCapability } from "../utopy/livingNodeUX";

type Props = {
  text: string;
  onTextChange: (text: string) => void;
  onSpeak: () => void;
  onCreate: (text: string, selections: string[], imageFile?: File) => Promise<any>;
  allLive: any[];
  privacyPolicies: string[];
  onTogglePrivacy: (policy: string) => void;
  rememberCapability: boolean;
  onToggleRemember: () => void;
  onLocate: () => void;
  locationReady: boolean;
  onShowMap?: (dv: any) => void;
  onShowResponses?: (dv?: any) => void;
};

const clean = (text: unknown) => String(text || "").trim();
const technical = /\b(?:did:|mt:|namespace|[a-z]+(?:[._:][a-z0-9]+){2,})\b/i;
const safeLabel = (text: unknown) => { const label = clean(text); return label && !technical.test(label) ? label : ""; };
const unique = (items: string[]) => [...new Set(items.map(safeLabel).filter(Boolean))];

type Question = { key: "what" | "where" | "when" | "quantity" | "price" | "range" | "conditions"; title: string; placeholder: string; options?: string[] };

const PATHS: Record<string, { question: string; options: string[] }> = {
  need: { question: "¿Qué necesitás?", options: ["Una persona", "Un trabajo o servicio", "Algo para comprar", "Material", "Entrega", "Espacio", "Financiación", "Aprender algo", "Ayuda", "Otra cosa"] },
  offer: { question: "¿Qué podés ofrecer?", options: ["Mi trabajo", "Un producto", "Un servicio", "Materiales", "Entregas", "Un espacio", "Una herramienta", "Conocimiento", "Tiempo o ayuda", "Otra cosa"] },
  opportunity: { question: "¿Qué te serviría?", options: ["Trabajo", "Trabajo este finde", "Algo cerca mío", "Ganar un extra", "Aprender ayudando", "Colaborar", "Oportunidades abiertas"] },
  sell: { question: "¿Qué querés vender?", options: ["Un producto", "Algo que hice", "Materiales", "Un espacio", "Otra cosa"] },
  help: { question: "¿Cómo querés ayudar?", options: ["Con mi tiempo", "Con mi trabajo", "Con transporte", "Con conocimiento", "Con materiales", "Con herramientas", "Con dinero", "Otra forma"] },
  create: { question: "¿Qué querés crear?", options: ["Algo físico", "Una casa o espacio", "Un mueble", "Ropa", "Joya", "Electrónica", "Un proyecto", "Contar mi idea"] },
  guide: { question: "¿Por dónde empezamos?", options: ["Necesito algo", "Tengo algo", "Busco una oportunidad", "Quiero hacer algo", "Quiero hablarlo"] },
};

export default function GuidedIntentComposer({ text, onTextChange, onSpeak, onCreate, allLive, privacyPolicies, onTogglePrivacy, rememberCapability, onToggleRemember, onLocate, locationReady, onShowMap, onShowResponses }: Props) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [path, setPath] = useState("");
  const [published, setPublished] = useState<any | null>(null);
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [imagePreview, setImagePreview] = useState("");
  useEffect(() => { if (!imageFile) { setImagePreview(""); return; } const url = URL.createObjectURL(imageFile); setImagePreview(url); return () => URL.revokeObjectURL(url); }, [imageFile]);
  const meaning = useMemo(() => interpretHumanSignal(text), [text]);
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const inferred = useMemo(() => {
    const labels = [
      meaning.frame.direction === "need" ? "Necesito" : meaning.frame.direction === "offer" ? "Ofrezco" : meaning.frame.direction === "can" ? "Puedo hacer" : meaning.frame.direction === "seek" ? /trabaj|empleo|oportunidad/.test(normalized) ? "Busco trabajo" : "Busco ayuda" : "Quiero hacer",
    ];
    if (/vend|venta/.test(normalized)) labels.push("Vendo");
    if (/entreg|transport|llevar|retir|repart/.test(normalized)) labels.push("Entrega");
    if (/cada\s|todos los|diari|seman|mensual|recurrent/.test(normalized)) labels.push("Recurrente");
    if (/material|madera|metal|insumo|leche|litro|kg\b/.test(normalized)) labels.push("Material");
    if (/trabaj|instal|repar|carpinter|fabric/.test(normalized)) labels.push("Trabajo");
    if (/niñer|niner|cuidar niños|cuidado de niños/.test(normalized)) labels.push("Cuidado de niños", "Trabajo");
    if (/finde|fin de semana|sabado|domingo/.test(normalized)) labels.push("Este finde");
    if (/financ|credito|cuotas?|prestamo/.test(normalized)) labels.push("Financiación");
    return unique(labels);
  }, [meaning.frame.direction, normalized]);
  const capabilityLabels = useMemo(() => unique(projectLivingNodes(allLive || [])
    .flatMap((node) => node.capabilities.map(humanCapability))), [allLive]);
  const dynamic = useMemo(() => {
    const words = new Set(normalized.split(/[^a-z0-9]+/).filter((word) => word.length > 3));
    return capabilityLabels.filter((label) => label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).some((word) => words.has(word))).slice(0, 18);
  }, [capabilityLabels, normalized]);
  const options = useMemo(() => unique(path ? [...(PATHS[path]?.options || []), ...dynamic] : [...inferred, ...dynamic]), [path, inferred, dynamic]);
  const questions = useMemo<Question[]>(() => {
    const chosen = selected.join(" ").toLowerCase();
    const list: Question[] = [];
    if (meaning.frame.provisional || /^(necesito|ofrezco|puedo|busco|quiero)\s+(algo|ayuda)?\s*$/i.test(text.trim())) list.push({ key: "what", title: "¿Qué es exactamente?", placeholder: "Contalo con tus palabras" });
    if (!meaning.frame.quantity && /(material|producto|madera|leche|litro|kg|vendo|cantidad)/.test(`${normalized} ${chosen}`)) list.push({ key: "quantity", title: "¿Cuánto?", placeholder: "Ej.: 20 litros, 3 unidades" });
    if ((/entreg|trabaj|material|espacio|necesit|busco|niñer|niner|cuidado/.test(`${normalized} ${chosen}`)) && !meaning.frame.territory && !locationReady) list.push({ key: "where", title: "¿Dónde?", placeholder: "Zona aproximada o ciudad" });
    if (/recurrent|cada|seman|diari|trabajo|niñer|niner|cuidado/.test(`${normalized} ${chosen}`) && !meaning.frame.time && !/finde|fin de semana/.test(normalized)) list.push({ key: "when", title: "¿Cuándo lo necesitás?", placeholder: "Ej.: lunes a viernes, 9 a 16", options: ["Una vez", "Cada día", "Cada semana", "Elegir frecuencia"] });
    if (/(vendo|precio|trabajo|niñer|niner|recompensa)/.test(`${normalized} ${chosen}`) && !/\b(?:gs\.?|₲|brl|r\$)\s*\d/.test(normalized)) list.push({ key: "price", title: "¿Hay precio o recompensa?", placeholder: "Opcional" });
    if (/(puedo hacer|ofrezco|entrega)/.test(chosen) && /entreg|instal|transport|servicio/.test(normalized) && !/\d+\s*km/.test(normalized)) list.push({ key: "range", title: "¿Hasta dónde podés llegar?", placeholder: "Ej.: 15 km, mi ciudad" });
    if (/niñer|niner|cuidado de niños/.test(normalized) && !/condicion|requisito/.test(normalized)) list.push({ key: "conditions", title: "¿Alguna condición importante?", placeholder: "Opcional: experiencia, horarios, cuidados…" });
    return list.filter((question) => !answers[question.key]);
  }, [selected, meaning.frame.provisional, meaning.frame.quantity, meaning.frame.territory, meaning.frame.time, text, normalized, locationReady, answers]);
  const currentQuestion = activeQuestions[questionIndex] || null;
  const previewText = useMemo(() => [text.trim(), answers.what, answers.quantity ? `Cantidad: ${answers.quantity}.` : "", answers.where ? `En ${answers.where}.` : "", answers.when ? `${answers.when}.` : "", answers.price ? `Precio o recompensa: ${answers.price}.` : "", answers.range ? `Alcance: ${answers.range}.` : "", answers.conditions ? `${answers.conditions}.` : ""].filter(Boolean).join(" "), [text, answers]);
  const totalSteps = (step < 2 ? questions : activeQuestions).length ? 4 : 3;
  const displayedStep = step === 3 ? totalSteps : step + 1;

  const goFromText = () => {
    if (!text.trim()) return;
    setPath("");
    setSelected(inferred);
    setStep(1);
  };
  const goFromOptions = () => { setActiveQuestions(questions); setQuestionIndex(0); setStep(questions.length ? 2 : 3); };
  const advanceQuestion = () => {
    if (questionIndex + 1 < activeQuestions.length) setQuestionIndex((index) => index + 1);
    else { setQuestionIndex(0); setStep(3); }
  };
  const create = async () => {
    if (pending || !previewText.trim()) return;
    setPending(true); setError("");
    try { setPublished(await onCreate(previewText, selected, imageFile)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos crear esto. Probá otra vez."); }
    finally { setPending(false); }
  };

  return <Composer>
    {published ? <Stage key="published"><Question>{privacyPolicies.includes("noShare") ? "✓ Guardado para vos" : "✓ Ya está en tu red"}</Question><Preview><p>{previewText.trim()}</p></Preview><Bottom><Secondary type="button" onClick={() => onShowResponses?.(published)}>Ver respuestas</Secondary>{!privacyPolicies.includes("noShare") ? <Primary type="button" onClick={() => onShowMap?.(published)}><MapPin size={17} /> Ver en mapa</Primary> : null}</Bottom></Stage> : <>
    {step > 0 ? <Progress><span>Tu semilla toma forma</span><small>{displayedStep}/{totalSteps}</small><i><b style={{ width: `${displayedStep / totalSteps * 100}%` }} /></i></Progress> : null}
    {step === 0 ? <Stage key="say">
      <Question>¿Qué querés hacer realidad?</Question>
      <InputModes><span><PenLine size={15}/>Escribir</span><button type="button" onClick={onSpeak}><Mic size={15}/>Hablar</button><label><ImagePlus size={15}/>Imagen<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => { const file = event.target.files?.[0]; if (file && file.size <= 8 * 1024 * 1024 && /^image\/(jpeg|png|webp|gif)$/.test(file.type)) { setImageFile(file); setError(""); } else if (file) setError("Elegí una imagen JPG, PNG, WebP o GIF de hasta 8 MB."); event.target.value = ""; }}/></label></InputModes>
      <Prompt maxLength={500} value={text} onChange={(event) => { setAnswers({}); onTextChange(event.target.value); }} placeholder="Necesito madera, quiero ofrecer un servicio, quiero vender algo…" aria-label="¿Qué querés hacer realidad?" />
      {imagePreview ? <ImageReference><img src={imagePreview} alt="Referencia de tu idea"/><span>Referencia visual. Contá con palabras qué querés hacer. Se sube al publicar, no antes.</span><button type="button" onClick={() => setImageFile(undefined)} aria-label="Quitar imagen"><X size={17}/></button></ImageReference> : null}
      <Primary type="button" disabled={!text.trim()} onClick={goFromText} style={{width:"100%",margin:0}}>Continuar <ArrowRight size={17}/></Primary>
      <Subline>O elegí un punto de partida</Subline>
      <SeedChoices>{([[ShoppingBag,"Vender","Un producto o servicio","Vendo ","sell"],[HeartHandshake,"Ofrecer","Algo que podés aportar","Ofrezco ","offer"],[Search,"Necesitar","Un recurso, trabajo o ayuda","Necesito ","need"],[Wrench,"Producir","Un trabajo o fabricación","Quiero producir ","create"]] as const).map(([Icon,label,hint,prefix,nextPath]) => <button type="button" key={label} onClick={() => { setAnswers({}); setPath(nextPath); setSelected([]); if (!text.trim()) onTextChange(prefix); setStep(1); }}><Icon size={21}/><b>{label}</b><small>{hint}</small><ArrowRight size={15}/></button>)}</SeedChoices>
      {error ? <ErrorText role="alert">{error}</ErrorText> : null}
    </Stage> : null}

    {step === 1 ? <Stage key="understood">
      <Question>{path ? PATHS[path]?.question : "Entendí esto. ¿Va por acá?"}</Question>
      {!path ? <Subline>{text.trim()}</Subline> : null}
      <Chips>{options.slice(0, showMore ? 18 : 8).map((label) => <Chip type="button" key={label} $active={selected.includes(label)} onClick={() => setSelected((current) => current.includes(label) ? current.filter((item) => item !== label) : [...current, label])}>{label}</Chip>)}</Chips>
      {options.length > 8 && !showMore ? <TextButton type="button" onClick={() => setShowMore(true)}><Plus size={15} /> Ver más</TextButton> : null}
      <Bottom><Back type="button" onClick={() => setStep(0)}><ArrowLeft size={16} /> Atrás</Back><Primary type="button" onClick={goFromOptions}>Seguir <ArrowRight size={17} /></Primary></Bottom>
    </Stage> : null}

    {step === 2 && currentQuestion ? <Stage key={`question:${currentQuestion.key}`}>
      <Question>{currentQuestion.title}</Question>
      {currentQuestion.options ? <StarterGrid>{currentQuestion.options.map((option) => <Starter key={option} type="button" onClick={() => { setAnswers((current) => ({ ...current, [currentQuestion.key]: option })); advanceQuestion(); }}>{option}</Starter>)}</StarterGrid> : null}
      <SingleInput value={answers[currentQuestion.key] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [currentQuestion.key]: event.target.value }))} placeholder={currentQuestion.placeholder} aria-label={currentQuestion.title} autoFocus />
      {currentQuestion.key === "where" ? <TextButton type="button" onClick={onLocate}>📍 {locationReady ? "Zona lista" : "Usar mi zona aproximada"}</TextButton> : null}
      <Bottom><Back type="button" onClick={() => { setQuestionIndex(0); setStep(1); }}><ArrowLeft size={16} /> Atrás</Back><Secondary type="button" onClick={advanceQuestion}>Ahora no</Secondary><Primary type="button" onClick={advanceQuestion}>Seguir <ArrowRight size={17} /></Primary></Bottom>
    </Stage> : null}

    {step === 3 ? <Stage key="preview">
      <Question>Entendí esto ✨</Question>
      {imagePreview ? <ImageReference><img src={imagePreview} alt="Imagen que vas a publicar"/><span>Al crear, esta imagen se guardará en el servicio multimedia público de Market.</span></ImageReference> : null}
      <Preview><p>{previewText.trim()}</p><Chips>{selected.map((label) => <PreviewChip key={label}>{label}</PreviewChip>)}{meaning.frame.time ? <PreviewChip>🗓 {meaning.frame.time}</PreviewChip> : null}{normalized.match(/\b\d{1,2}\s*(?:a|-|–)\s*\d{1,2}\b/)?.[0] ? <PreviewChip>🕘 {normalized.match(/\b\d{1,2}\s*(?:a|-|–)\s*\d{1,2}\b/)?.[0]}</PreviewChip> : null}{answers.where ? <PreviewChip>📍 {answers.where}</PreviewChip> : null}</Chips>{/trabaj|oportunidad|niñer|niner/.test(normalized) ? <small>Personas interesadas pueden responder por conversación, aunque no tengan esa capacidad en su perfil.</small> : null}</Preview>
      <TextButton type="button" onClick={() => setStep(1)}><Plus size={15} /> Agregar algo más</TextButton>
      <Privacy open><summary>¿Quién puede verlo?</summary><PrivacyChoices><Chip type="button" $active={!privacyPolicies.includes("noShare")} onClick={() => { if (privacyPolicies.includes("noShare")) onTogglePrivacy("noShare"); }}>Cualquiera</Chip><Chip type="button" $active={privacyPolicies.includes("noShare")} onClick={() => { if (!privacyPolicies.includes("noShare")) onTogglePrivacy("noShare"); }}>Solo yo</Chip></PrivacyChoices><small>Tu ubicación exacta nunca se publica.</small><details><summary>Más privacidad</summary><PrivacyChoices>{[["noAITraining", "No usar para entrenar IA"], ["noReproduce", "No reproducir"], ["noDerivative", "No derivar"], ["noLocationDisclosure", "Ocultar mi zona"]].map(([key, label]) => <Chip type="button" key={key} $active={privacyPolicies.includes(key)} onClick={() => onTogglePrivacy(key)}>{label}</Chip>)}<Chip type="button" $active={rememberCapability} onClick={onToggleRemember}>Guardar en Mi Valor</Chip></PrivacyChoices></details></Privacy>
      {error ? <ErrorText role="alert">{error}</ErrorText> : null}
      <Bottom><Back type="button" onClick={() => { setQuestionIndex(0); setStep(1); }}><ArrowLeft size={16} /> Cambiar</Back><Primary type="button" disabled={pending} onClick={create}><Sparkles size={17} /> {pending ? "Creando…" : "Crear"}</Primary></Bottom>
    </Stage> : null}
    </>}
  </Composer>;
}

const rise = keyframes`from{opacity:0;translate:0 7px}to{opacity:1;translate:0 0}`;
const Composer = styled.div`display:grid;gap:16px;min-height:0;color:var(--utopy-carbon,#22232a);button{font:inherit}button:focus-visible,label:focus-within{outline:3px solid #b8a2f3;outline-offset:3px}`;
const InputModes = styled.div`display:flex;align-items:center;gap:8px;flex-wrap:wrap;>span,button,label{display:flex;align-items:center;gap:7px;min-height:40px;border:0;border-radius:12px;padding:9px 13px;background:#f4f2f8;color:#756d84;font-size:12px;cursor:pointer}>span{color:#7863c4;background:#eee8fc}`;
const ImageReference = styled.div`display:flex;align-items:center;gap:12px;padding:10px;border:1px solid #e8e3ef;border-radius:16px;background:white;img{width:76px;height:70px;border-radius:12px;object-fit:cover}span{font-size:11px;line-height:1.6;color:#706b7e;flex:1}button{display:grid;place-items:center;width:38px;height:38px;border:0;border-radius:50%;background:#f4f2f8;cursor:pointer}`;
const SeedChoices = styled.div`display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;button{position:relative;display:grid;gap:7px;align-content:start;min-width:0;padding:14px 12px;border:1px solid #ebe7f1;border-radius:18px;background:#fff;text-align:left;cursor:pointer}button>svg:first-child{box-sizing:content-box;color:#7863c4;background:#f1ecfc;padding:10px;border-radius:14px}b{font-size:13px;font-weight:650;color:#28252f}small{font-size:10px;line-height:1.6;color:#837c90}button>svg:last-child{position:absolute;right:11px;top:21px;color:#9b92aa}@media(max-width:580px){grid-template-columns:repeat(2,minmax(0,1fr))}`;
const Progress = styled.div`display:grid;grid-template-columns:1fr auto;gap:8px 12px;align-items:center;padding:5px 3px 0;color:#586895;font-size:12px;font-weight:800;i{grid-column:1/-1;height:4px;border-radius:999px;background:rgba(137,149,211,.18);overflow:hidden}i b{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#6fcab6,#8293ee);transition:width .19s ease}small{font-size:11px}`;
const Stage = styled.div`display:flex;flex-direction:column;gap:18px;min-height:0;animation:${rise} 190ms ease-out both;@media(prefers-reduced-motion:reduce){animation:none}`;
const Question = styled.h2`margin:8px 0 0;font-size:clamp(23px,3vw,30px);line-height:1.14;letter-spacing:-.035em;color:#233456`;
const Subline = styled.p`margin:0;color:#64728e;font-size:14px;line-height:1.4`;
const Prompt = styled.textarea`width:100%;min-height:130px;resize:vertical;border:1px solid #e8e3ef;border-radius:16px;background:#fff;padding:16px;color:#28252f;font:inherit;font-size:16px;outline:0;:focus{border-color:#a58bdd;box-shadow:0 0 0 3px #eee8fc}@media(max-width:650px){min-height:150px}`;
const StarterGrid = styled.div`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;max-height:235px;overflow:auto;@media(max-width:420px){grid-template-columns:1fr;max-height:195px}`;
const Starter = styled.button`min-height:58px;border:1px solid white;border-radius:18px;background:rgba(255,255,255,.67);color:#40518a;padding:11px;text-align:left;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 6px 17px rgba(85,97,165,.07);:hover{background:white}`;
const Chips = styled.div`display:flex;flex-wrap:wrap;align-content:flex-start;gap:8px;max-height:230px;overflow:auto`;
const Chip = styled.button<{ $active?: boolean }>`border:1px solid ${({ $active }) => $active ? "#9aacef" : "rgba(255,255,255,.95)"};border-radius:999px;background:${({ $active }) => $active ? "rgba(222,232,255,.94)" : "rgba(255,255,255,.62)"};color:#40528a;padding:11px 15px;font-size:13px;font-weight:800;cursor:pointer;:hover{background:white}`;
const PreviewChip = styled.span`border:1px solid white;border-radius:999px;background:rgba(255,255,255,.65);padding:7px 11px;color:#5060a2;font-size:12px;font-weight:800`;
const SingleInput = styled.input`width:100%;border:1px solid white;border-radius:20px;background:rgba(255,255,255,.74);padding:16px;color:#263654;font:inherit;font-size:17px;outline:0;:focus{border-color:#a5b3ee;box-shadow:0 0 0 4px rgba(141,157,235,.15)}`;
const Preview = styled.div`display:grid;gap:14px;padding:19px;border:1px solid white;border-radius:23px;background:rgba(255,255,255,.68);box-shadow:0 8px 22px rgba(76,88,157,.08);p{margin:0;font-size:17px;line-height:1.45;font-weight:750}small{color:#697594;font-size:12px;line-height:1.4}`;
const Privacy = styled.details`summary{cursor:pointer;color:#63719b;font-size:12px;font-weight:750}max-height:190px;overflow:auto;small{display:block;margin-top:6px;color:#7b87a0;font-size:11px}details{margin-top:8px}`;
const PrivacyChoices = styled.div`display:flex;flex-wrap:wrap;gap:6px;padding-top:9px;${Chip}{font-size:11px;padding:7px 9px}`;
const Bottom = styled.div`display:flex;align-items:center;gap:9px;margin-top:auto;padding-top:12px;position:sticky;bottom:0;background:linear-gradient(0deg,rgba(240,241,255,.96),rgba(240,241,255,0));@media(max-width:650px){padding-bottom:env(safe-area-inset-bottom)}`;
const Primary = styled.button`display:flex;align-items:center;justify-content:center;gap:8px;margin-left:auto;min-height:48px;border:0;border-radius:14px;background:var(--utopy-lavender,#7863c4);color:white;padding:10px 18px;font-weight:650;cursor:pointer;:disabled{opacity:.5;cursor:default}`;
const Secondary = styled.button`display:flex;align-items:center;justify-content:center;gap:7px;min-height:45px;border:1px solid white;border-radius:16px;background:rgba(255,255,255,.64);color:#5364aa;padding:10px 13px;font-weight:800;cursor:pointer`;
const Back = styled.button`display:flex;align-items:center;gap:5px;border:0;background:transparent;color:#637198;padding:10px 4px;font-weight:800;cursor:pointer`;
const TextButton = styled.button`display:flex;align-items:center;gap:5px;align-self:flex-start;border:0;background:transparent;color:#5869b3;font-size:12px;font-weight:800;cursor:pointer`;
const ErrorText = styled.p`margin:0;color:#a83d60;font-size:13px`;
