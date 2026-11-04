import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Bird, Check, ChevronDown, Clipboard, Clock3, FileSearch, Flame,
  Ghost, HelpCircle, Languages, Link2, LoaderCircle, LockKeyhole, Moon, OctagonAlert,
  ScanLine, ShieldCheck, Sparkles, Upload, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Language = 'en' | 'hi' | 'mr';
type DocumentType = 'rental' | 'loan' | 'internship';
type RiskLevel = 'Low' | 'Medium' | 'High';
type Filter = 'All' | RiskLevel;

type Clause = {
  clause_text: string;
  risk_level: RiskLevel;
  category: string;
  risk_score: number;
  explanation: string;
  questions_to_ask: string[];
  safer_wording: string;
};

type Report = {
  id: string;
  created_at: string;
  expires_at: string;
  language: Language;
  document_type: DocumentType;
  clauses: Clause[];
  scare_score: number;
  verdict: string;
};

const sampleAgreement = `RESIDENTIAL RENTAL AGREEMENT

The tenant shall pay a security deposit of ₹30,000. The landlord may deduct any amount from the deposit for repainting, cleaning, repairs, or any other reason deemed appropriate.

The tenant agrees to a lock-in period of 11 months. If the tenant leaves before the lock-in period ends, the tenant must pay rent for all remaining months.

Rent will increase automatically by 12% every 12 months. This agreement renews automatically unless the tenant gives 90 days written notice before expiry.

The tenant shall pay a late fee of ₹2,000 for any rent paid after the 5th day of the month, in addition to interest at 5% per month.

The landlord may terminate this agreement immediately without notice if the landlord believes the property is being used improperly. The tenant must give 60 days notice to terminate.

Any dispute shall be resolved exclusively through arbitration in Mumbai, and the tenant waives the right to approach any court.`;

const languageLabels: Record<Language, string> = { en: 'English', hi: 'हिन्दी', mr: 'मराठी' };
const documentLabels: Record<DocumentType, string> = { rental: 'Rental agreement', loan: 'Loan agreement', internship: 'Internship offer' };

const copy = {
  en: {
    explain: 'In plain English',
    questions: 'Questions to ask',
    safer: 'Safer wording to request',
    verdict: (score: number) => score >= 70 ? 'Quite a few ghosts in this fine print.' : score >= 40 ? 'A few things are lurking here.' : 'This agreement looks mostly calm.',
  },
  hi: {
    explain: 'सरल हिन्दी में', questions: 'पूछने वाले सवाल', safer: 'माँगी जाने वाली सुरक्षित भाषा',
    verdict: (score: number) => score >= 70 ? 'इस बारीक प्रिंट में कई जोखिम छिपे हैं।' : score >= 40 ? 'यहाँ कुछ बातें ध्यान देने लायक हैं।' : 'यह समझौता ज़्यादातर सुरक्षित दिखता है।',
  },
  mr: {
    explain: 'सोप्या मराठीत', questions: 'विचारायचे प्रश्न', safer: 'मागण्यासाठी सुरक्षित शब्दरचना',
    verdict: (score: number) => score >= 70 ? 'या बारीक अटींमध्ये अनेक धोके लपलेले आहेत.' : score >= 40 ? 'इथे काही गोष्टींकडे लक्ष द्यायला हवे.' : 'हा करार बहुतांश सुरक्षित दिसतो.',
  },
};

const translations: Record<Language, Record<string, string>> = {
  en: {},
  hi: {
    'deposit deductions': 'जमा राशि में कटौती', 'lock-in period': 'लॉक-इन अवधि', penalty: 'जुर्माना',
    'auto-renewal': 'अपने-आप नवीनीकरण', termination: 'समाप्ति', arbitration: 'मध्यस्थता',
  },
  mr: {
    'deposit deductions': 'ठेवीतील कपात', 'lock-in period': 'लॉक-इन कालावधी', penalty: 'दंड',
    'auto-renewal': 'स्वयं नूतनीकरण', termination: 'समाप्ती', arbitration: 'लवाद',
  },
};

function translateCategory(category: string, language: Language) {
  return translations[language][category] || category;
}

function analyzeAgreement(text: string, language: Language): Clause[] {
  const pieces = text.split(/(?<=[.!?])\s+|\n{2,}/).map((part) => part.trim()).filter((part) => part.length > 35);
  const rules: { keywords: string[]; category: string; score: number; explanation: string; questions: string[]; safer: string }[] = [
    { keywords: ['deposit', 'deduct', 'repaint', 'cleaning', 'repair'], category: 'deposit deductions', score: 82, explanation: 'This gives the other party broad power to keep your deposit without a clear list of charges, proof, or a chance to dispute them.', questions: ['What exact deductions are allowed?', 'Will I receive itemised bills and photos?'], safer: 'Deductions should be limited to documented, tenant-caused damage beyond normal wear and tear, with an itemised statement.' },
    { keywords: ['lock-in', 'remaining months', 'leave before'], category: 'lock-in period', score: 90, explanation: 'A lock-in can make leaving expensive even when the arrangement is no longer workable. The cost is not capped here.', questions: ['Can the lock-in be removed or shortened?', 'Is there a replacement-tenant option?'], safer: 'Either party may end the agreement with 30 days notice, without rent for the remaining term.' },
    { keywords: ['late fee', 'penalty', 'interest', '₹2,000', 'fine'], category: 'penalty', score: 76, explanation: 'Multiple charges for one late payment may grow quickly and may not reflect the actual loss caused by the delay.', questions: ['Is there a grace period?', 'Can the late charge be a reasonable one-time amount?'], safer: 'A reasonable one-time late fee applies only after a 7-day grace period, with no additional monthly penalty.' },
    { keywords: ['automatically', 'renews', 'renewal', '12%'], category: 'auto-renewal', score: 68, explanation: 'The agreement can continue and the price can rise unless you remember a long notice deadline. That is easy to miss.', questions: ['Will you send a renewal reminder?', 'Can the increase be capped?'], safer: 'Renewal requires written agreement from both parties, with any increase disclosed at least 60 days ahead.' },
    { keywords: ['terminate', 'termination', 'without notice', 'immediately'], category: 'termination', score: 88, explanation: 'One side can end the agreement immediately while the other side has a longer notice duty. That imbalance should be clarified.', questions: ['What specific breach allows immediate termination?', 'Do both parties get the same notice period?'], safer: 'Termination requires written notice and a reasonable opportunity to fix a breach, except for urgent safety issues.' },
    { keywords: ['arbitration', 'jurisdiction', 'court', 'dispute'], category: 'arbitration', score: 55, explanation: 'This sends disputes to a particular process or city, which may make it harder and more expensive for you to challenge a problem.', questions: ['Who pays the arbitration costs?', 'Can disputes be heard where I live?'], safer: 'Disputes may be resolved in the local courts, with arbitration only by mutual written consent.' },
  ];

  const findings = pieces.map((piece) => {
    const lower = piece.toLowerCase();
    const match = rules.find((rule) => rule.keywords.some((keyword) => lower.includes(keyword.toLowerCase())));
    if (match) {
      const level: RiskLevel = match.score >= 75 ? 'High' : match.score >= 45 ? 'Medium' : 'Low';
      const explanation = language === 'en' ? match.explanation : language === 'hi' ? `यह शर्त आपको नुकसान पहुँचा सकती है क्योंकि इसमें आपकी ज़िम्मेदारी स्पष्ट रूप से सीमित नहीं है। ${match.explanation}` : `ही अट तुमच्यासाठी धोकादायक ठरू शकते, कारण तुमची जबाबदारी स्पष्टपणे मर्यादित केलेली नाही. ${match.explanation}`;
      return { clause_text: piece, risk_level: level, category: match.category, risk_score: match.score, explanation, questions_to_ask: match.questions, safer_wording: match.safer };
    }
    return { clause_text: piece, risk_level: 'Low' as RiskLevel, category: 'general terms', risk_score: 18, explanation: language === 'en' ? 'No obvious red flag matched this sentence, but make sure the surrounding definitions and exceptions are also clear.' : language === 'hi' ? 'इस वाक्य में कोई स्पष्ट बड़ा जोखिम नहीं मिला, फिर भी इससे जुड़ी परिभाषाएँ और अपवाद ध्यान से पढ़ें।' : 'या वाक्यात मोठा स्पष्ट धोका दिसला नाही, तरी संबंधित व्याख्या आणि अपवाद नीट वाचा.', questions_to_ask: ['Can this term be explained in simpler language?'], safer_wording: 'Use clear language that states each party’s responsibility and any limits.' };
  });

  return findings.length ? findings : [{ clause_text: text.slice(0, 500), risk_level: 'Low', category: 'general terms', risk_score: 20, explanation: 'We could not split this into many clauses, so treat this first pass as a prompt for questions, not a final conclusion.', questions_to_ask: ['Can I get this agreement in a clearer format?'], safer_wording: 'Ask for clear headings, definitions, notice periods, and limits on charges.' }];
}

function scoreColor(score: number) { return score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'safe'; }

function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [documentType, setDocumentType] = useState<DocumentType>('rental');
  const [text, setText] = useState('');
  const [screen, setScreen] = useState<'landing' | 'processing' | 'report'>('landing');
  const [report, setReport] = useState<Report | null>(null);
  const [filter, setFilter] = useState<Filter>('All');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0);

  const visibleClauses = useMemo(() => report?.clauses.filter((clause) => filter === 'All' || clause.risk_level === filter) ?? [], [report, filter]);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/report\/([^/]+)$/);
    if (match) void loadReport(match[1]);
  }, []);

  async function createReport(source: string) {
    setError('');
    setText(source);
    setScreen('processing');
    setProgress(8);
    await new Promise((resolve) => setTimeout(resolve, 500)); setProgress(34);
    await new Promise((resolve) => setTimeout(resolve, 500)); setProgress(63);
    const clauses = analyzeAgreement(source, language);
    const scareScore = Math.round(clauses.reduce((sum, clause) => sum + clause.risk_score, 0) / clauses.length);
    await new Promise((resolve) => setTimeout(resolve, 500)); setProgress(88);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
    const draft = { language, document_type: documentType, source_text: source, clauses, scare_score: scareScore, verdict: copy[language].verdict(scareScore), expires_at: expiresAt.toISOString() };
    if (supabase) {
      await supabase.rpc('cleanup_expired_haunted_reports');
      const { data, error: saveError } = await supabase.from('haunted_clauses_reports').insert(draft).select('id, created_at, expires_at, language, document_type, clauses, scare_score, verdict').maybeSingle();
      if (saveError || !data) { setError('We could not save this report. Please try again.'); setScreen('landing'); return; }
      setReport(data as Report);
      window.history.pushState({}, '', `/report/${data.id}`);
    } else {
      const fallback = { ...draft, id: crypto.randomUUID(), created_at: createdAt.toISOString() } as Report;
      localStorage.setItem(`haunted-report-${fallback.id}`, JSON.stringify(fallback));
      setReport(fallback);
      window.history.pushState({}, '', `/report/${fallback.id}`);
    }
    setProgress(100);
    setScreen('report');
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('That file is too large. Please choose one under 10 MB.'); return; }
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      void file.text().then((value) => createReport(value));
    } else {
      setError('For this demo, paste the text from a PDF or image, or start with the sample agreement. PDF and image extraction is ready for an AWS OCR endpoint via the API setting.');
    }
  }

  async function loadReport(id: string) {
    if (supabase) {
      await supabase.rpc('cleanup_expired_haunted_reports');
      const { data } = await supabase.from('haunted_clauses_reports').select('id, created_at, expires_at, language, document_type, clauses, scare_score, verdict').eq('id', id).maybeSingle();
      if (data) { setReport(data as Report); setLanguage(data.language as Language); setDocumentType(data.document_type as DocumentType); setScreen('report'); }
    } else {
      const stored = localStorage.getItem(`haunted-report-${id}`);
      if (stored) { setReport(JSON.parse(stored) as Report); setScreen('report'); }
    }
  }

  function copyQuestions() {
    const questions = visibleClauses.flatMap((clause) => clause.questions_to_ask.map((question) => `• ${question}`)).join('\n');
    void navigator.clipboard.writeText(questions);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  }

  if (screen === 'processing') return <Processing progress={progress} />;
  if (screen === 'report' && report) return <ReportView report={report} filter={filter} setFilter={setFilter} clauses={visibleClauses} copyQuestions={copyQuestions} copied={copied} onBack={() => { window.history.pushState({}, '', '/'); setScreen('landing'); }} />;

  return <Landing language={language} setLanguage={setLanguage} documentType={documentType} setDocumentType={setDocumentType} text={text} setText={setText} error={error} onFile={handleFile} onAnalyze={() => void createReport(text)} onSample={() => void createReport(sampleAgreement)} />;
}

function Brand() {
  return <div className="brand"><span className="brand-mark"><Ghost size={23} fill="currentColor" /><span className="brand-spark">✦</span></span><span>Haunted Clauses</span></div>;
}

function Landing({ language, setLanguage, documentType, setDocumentType, text, setText, error, onFile, onAnalyze, onSample }: { language: Language; setLanguage: (value: Language) => void; documentType: DocumentType; setDocumentType: (value: DocumentType) => void; text: string; setText: (value: string) => void; error: string; onFile: (event: ChangeEvent<HTMLInputElement>) => void; onAnalyze: () => void; onSample: () => void; }) {
  return <div className="app-shell landing-shell"><div className="stars" /><header className="topbar"><Brand /><div className="header-note"><LockKeyhole size={14} /> Private by design <span className="header-dot" /> Deletes in 24h</div></header><main className="landing-content"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot" /> Hack-To-ween 2026 <span className="eyebrow-line" /> AWS · Chamber 01</div><h1>Understand the agreement<br /><span>before you sign.</span></h1><p className="hero-subtitle">Your friendly ghost-hunter for the fine print hiding in rental, loan, and internship agreements.</p><div className="hero-badges"><span><ShieldCheck size={15} /> Plain-language explanations</span><span><Languages size={15} /> English · हिन्दी · मराठी</span></div></div><section className="scan-card"><div className="ghost-orbit"><div className="orbit-ring" /><div className="ghost-body"><Ghost size={72} fill="currentColor" strokeWidth={1.5} /><span className="ghost-eye left" /><span className="ghost-eye right" /></div><span className="orbit-pumpkin">◒</span><Bird className="orbit-bat" size={25} fill="currentColor" /></div><div className="scan-card-copy"><h2>What are you signing?</h2><p>Drop in the agreement. We’ll point out the clauses worth a second look.</p></div><label className="upload-zone"><input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={onFile} /><Upload size={19} /><strong>Upload agreement</strong><span>PDF, image, or text file · up to 10 MB</span></label><div className="or-row"><span /> or <span /></div><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste agreement text here..." aria-label="Paste agreement text" /><div className="scan-options"><label><span>Language</span><div className="select-wrap"><Languages size={15} /><select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>{Object.entries(languageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={14} /></div></label><label><span>Document type</span><div className="select-wrap"><FileSearch size={15} /><select value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)}>{Object.entries(documentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={14} /></div></label></div>{error && <div className="error-note"><OctagonAlert size={16} /> {error}</div>}<button className="primary-button scan-button" onClick={onAnalyze} disabled={!text.trim()}><ScanLine size={19} /> Hunt for hidden ghosts <ArrowRight size={18} /></button><button className="sample-button" onClick={onSample}><Sparkles size={16} /> Try the sample rental agreement</button></section><div className="how-row"><div><span className="step-number">01</span><strong>Upload</strong><span>your agreement</span></div><ArrowRight size={16} /><div><span className="step-number">02</span><strong>Ghost scan</strong><span>the fine print</span></div><ArrowRight size={16} /><div><span className="step-number">03</span><strong>Ask better</strong><span>questions</span></div></div></main><footer className="site-footer"><span>Built for Hack-To-ween 2026</span><span className="footer-center"><Moon size={14} /> Informational only, not legal advice.</span><span>Built on AWS <span className="footer-asterisk">✦</span></span></footer></div>;
}

function Processing({ progress }: { progress: number }) {
  const steps = ['Uploading agreement', 'Extracting text', 'Ghost scan', 'Writing your report'];
  return <div className="app-shell processing-shell"><header className="topbar"><Brand /><div className="header-note"><LockKeyhole size={14} /> Private by design</div></header><main className="processing-main"><div className="processing-ghost"><Ghost size={86} fill="currentColor" strokeWidth={1.5} /><Sparkles className="processing-spark" size={24} /></div><p className="eyebrow centered"><span className="eyebrow-dot" /> The séance is underway</p><h1>Looking for the<br /><span>fine-print ghosts.</span></h1><p className="processing-copy">We’re reading between the lines so you don’t have to.</p><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><div className="processing-steps">{steps.map((step, index) => <div key={step} className={progress >= (index + 1) * 25 ? 'done' : progress > index * 25 ? 'active' : ''}><span className="step-icon">{progress >= (index + 1) * 25 ? <Check size={14} /> : <span>{index + 1}</span>}</span><span>{step}</span></div>)}</div><div className="processing-tip"><Flame size={16} /> Looking closely at deposits, lock-ins, penalties, renewals and more.</div></main></div>;
}

function ReportView({ report, filter, setFilter, clauses, copyQuestions, copied, onBack }: { report: Report; filter: Filter; setFilter: (value: Filter) => void; clauses: Clause[]; copyQuestions: () => void; copied: boolean; onBack: () => void; }) {
  const tone = scoreColor(report.scare_score);
  const timeLeft = Math.max(1, Math.round((new Date(report.expires_at).getTime() - Date.now()) / 3600000));
  return <div className="app-shell report-shell"><header className="topbar report-topbar"><button className="back-button" onClick={onBack}><ArrowLeft size={17} /> New scan</button><Brand /><button className="share-button" onClick={() => void navigator.clipboard.writeText(window.location.href)}><Link2 size={16} /> Share report</button></header><main className="report-main"><div className="report-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> Scan complete · {documentLabels[report.document_type]}</p><h1>Your fine-print <span>field guide.</span></h1><p className="report-meta"><Clock3 size={15} /> This report auto-deletes in about {timeLeft} hours · {languageLabels[report.language]}</p></div><div className="report-actions"><button className="copy-button" onClick={copyQuestions}>{copied ? <Check size={17} /> : <Clipboard size={17} />} {copied ? 'Copied questions' : 'Copy questions'}</button></div></div><section className={`score-panel ${tone}`}><div className="score-copy"><div className="score-label"><Flame size={16} /> Scare meter</div><div className="score-number">{report.scare_score}<span>/100</span></div><h2>{report.verdict}</h2><p>We found {report.clauses.filter((clause) => clause.risk_level !== 'Low').length} clause{report.clauses.filter((clause) => clause.risk_level !== 'Low').length === 1 ? '' : 's'} worth discussing before you sign.</p></div><div className="meter-wrap"><div className="meter"><div className="meter-needle" style={{ transform: `rotate(${(report.scare_score / 100) * 180 - 90}deg)` }} /></div><div className="meter-labels"><span>Calm</span><span>Spooky</span><span>Scary</span></div></div></section><div className="clause-toolbar"><div><h2>Clauses to look at</h2><p>Plain-language notes, not legal advice.</p></div><div className="filters">{(['All', 'High', 'Medium', 'Low'] as Filter[]).map((value) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}{value !== 'All' && <span>{report.clauses.filter((clause) => clause.risk_level === value).length}</span>}</button>)}</div></div><div className="clause-list">{clauses.map((clause, index) => <ClauseCard key={`${clause.category}-${index}`} clause={clause} language={report.language} index={index} />)}</div>{clauses.length === 0 && <div className="empty-state"><Ghost size={34} /> No clauses in this lane. The ghosts are hiding elsewhere.</div>}<div className="report-disclaimer"><HelpCircle size={18} /><div><strong>Keep your questions handy.</strong><p>Haunted Clauses is informational only, not legal advice. Consult a qualified professional for important decisions.</p></div></div></main><footer className="site-footer report-footer"><span>Haunted Clauses <span className="footer-asterisk">✦</span></span><span>Built for Hack-To-ween 2026 · Built on AWS</span></footer></div>;
}

function ClauseCard({ clause, language, index }: { clause: Clause; language: Language; index: number }) {
  return <article className={`clause-card ${clause.risk_level.toLowerCase()}`}><div className="clause-top"><span className="clause-index">0{index + 1}</span><span className={`risk-badge ${clause.risk_level.toLowerCase()}`}>{clause.risk_level === 'High' ? <OctagonAlert size={13} /> : clause.risk_level === 'Medium' ? <Flame size={13} /> : <ShieldCheck size={13} />}{clause.risk_level} risk</span><span className="category-tag">{translateCategory(clause.category, language)}</span><span className="mini-score">{clause.risk_score}/100</span></div><div className="clause-body"><div className="original-clause"><span>Original clause</span><blockquote>“{clause.clause_text}”</blockquote></div><div className="explanation"><span>{copy[language].explain}</span><p>{clause.explanation}</p></div><div className="clause-grid"><div><span>{copy[language].questions}</span><ul>{clause.questions_to_ask.map((question) => <li key={question}>{question}</li>)}</ul></div><div className="safer-box"><span>{copy[language].safer}</span><p>{clause.safer_wording}</p></div></div></div></article>;
}

export default App;
