'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Flame,
  Globe2,
  GraduationCap,
  Lightbulb,
  Map,
  MapPinned,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';

import {
  allCountryCodes,
  continentOptions,
  getCountryCapital,
  getCountryContinent,
  getCountryFact,
  getCountryFlag,
  getCountryName,
  microCountryCodes,
  shuffle,
  sovereignByContinent,
  type ContinentCode,
} from '@/lib/countries';

type MapData = {
  viewBox: string;
  locations: Array<{ id: string; name: string; path: string }>;
};

type GameMode = 'world' | 'continent' | 'review';
type Screen = 'home' | 'game' | 'result';
type Feedback = 'idle' | 'wrong' | 'correct';

type RoundResult = {
  code: string;
  firstTry: boolean;
  missed: boolean;
};

type PlayerStats = {
  totalCorrect: number;
  totalPlayed: number;
  bestStreak: number;
  review: Record<string, number>;
  lastPlayedAt?: string;
};

type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

const STORAGE_KEY = 'where-country-progress-v1';
const QUESTION_COUNT = 10;
const starterCountries = ['KR', 'JP', 'CN', 'IN', 'US', 'CA', 'BR', 'FR', 'GB', 'DE', 'IT', 'ES', 'EG', 'ZA', 'AU', 'NZ'];

const initialStats: PlayerStats = {
  totalCorrect: 0,
  totalPlayed: 0,
  bestStreak: 0,
  review: {},
};

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function MapBoard({
  map,
  targetCode,
  lastGuess,
  feedback,
  hintLevel,
  zoom,
  playable,
  onSelect,
}: {
  map: MapData | null;
  targetCode?: string;
  lastGuess?: string | null;
  feedback?: Feedback;
  hintLevel?: number;
  zoom: number;
  playable: boolean;
  onSelect?: (code: string) => void;
}) {
  const countrySet = useMemo(() => new Set(allCountryCodes), []);

  return (
    <div className="map-scroll" aria-busy={!map}>
      {!map && (
        <div className="absolute inset-0 z-10 grid place-items-center">
          <div className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-extrabold text-[#48616d] shadow-sm">
            <Globe2 className="size-4 animate-spin text-[#39b879]" /> 지도 펼치는 중…
          </div>
        </div>
      )}
      <svg
        viewBox={map?.viewBox ?? '0 0 1010 666'}
        aria-label={playable ? '나라를 선택할 수 있는 세계지도' : '세계지도 미리보기'}
        className="world-map"
        style={{ width: `${zoom * 100}%` }}
      >
        {map?.locations.map((location, index) => {
          const code = location.id.toUpperCase();
          const isCorrect = feedback === 'correct' && code === targetCode;
          const isWrong = feedback === 'wrong' && code === lastGuess;
          const isHint = hintLevel === 2 && code === targetCode;
          const isGameCountry = countrySet.has(code);
          const previewClass = !playable && isGameCountry && index % 7 === 0 ? 'is-preview' : '';

          return (
            <path
              key={location.id}
              d={location.path}
              role={playable ? 'button' : undefined}
              tabIndex={playable && isGameCountry ? 0 : -1}
              aria-label={playable ? getCountryName(code) : undefined}
              aria-disabled={!isGameCountry}
              onClick={() => playable && isGameCountry && onSelect?.(code)}
              onKeyDown={(event) => {
                if (playable && isGameCountry && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  onSelect?.(code);
                }
              }}
              className={`map-country ${!isGameCountry ? 'is-territory' : ''} ${previewClass} ${isCorrect ? 'is-correct' : ''} ${isWrong ? 'is-wrong' : ''} ${isHint ? 'is-hint' : ''}`}
            >
              {playable && <title>{getCountryName(code)}</title>}
            </path>
          );
        })}
      </svg>
    </div>
  );
}

export default function Home() {
  const [worldMap, setWorldMap] = useState<MapData | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedMode, setSelectedMode] = useState<GameMode>('world');
  const [selectedContinent, setSelectedContinent] = useState<ContinentCode>('AS');
  const [questions, setQuestions] = useState<string[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>('idle');
  const [lastGuess, setLastGuess] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [sessionBestStreak, setSessionBestStreak] = useState(0);
  const [firstTryCount, setFirstTryCount] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [sessionMisses, setSessionMisses] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [soundOn, setSoundOn] = useState(true);
  const [stats, setStats] = useState<PlayerStats>(initialStats);
  const [statsReady, setStatsReady] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);

  const targetCode = questions[questionIndex];
  const reviewCount = Object.values(stats.review).filter((count) => count > 0).length;
  const selectedContinentInfo = continentOptions.find((item) => item.code === selectedContinent)!;
  const targetContinent = targetCode
    ? continentOptions.find((item) => item.code === getCountryContinent(targetCode))
    : undefined;

  useEffect(() => {
    let active = true;
    void import('@svg-maps/world')
      .then((module) => {
        if (active) setWorldMap(module.default as MapData);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setStats({ ...initialStats, ...(JSON.parse(saved) as PlayerStats) });
      } catch {
        // A fresh progress record is safe when storage is unavailable or malformed.
      } finally {
        setStatsReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!statsReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch {
      // The game remains fully playable when browser storage is disabled.
    }
  }, [stats, statsReady]);

  function playTone(correct: boolean) {
    if (!soundOn || typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const context = audioContext.current ?? new AudioContextClass();
    audioContext.current = context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = correct ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(correct ? 520 : 170, context.currentTime);
    if (correct) oscillator.frequency.exponentialRampToValueAtTime(780, context.currentTime + 0.13);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.19);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  }

  const startGame = useCallback(
    (mode: GameMode = selectedMode, continent: ContinentCode = selectedContinent) => {
      const mapIds = new Set(worldMap?.locations.map((location) => location.id.toUpperCase()) ?? allCountryCodes);
      let pool: string[];
      if (mode === 'continent') {
        pool = sovereignByContinent[continent];
      } else if (mode === 'review') {
        pool = Object.entries(stats.review)
          .filter(([, count]) => count > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([code]) => code);
        if (pool.length < 3) pool = [...new Set([...pool, ...starterCountries])];
      } else {
        pool = allCountryCodes;
      }

      const prepared = shuffle(pool.filter((code) => mapIds.has(code))).slice(0, QUESTION_COUNT);
      setSelectedMode(mode);
      setSelectedContinent(continent);
      setQuestions(prepared);
      setQuestionIndex(0);
      setFeedback('idle');
      setLastGuess(null);
      setAttempts(0);
      setTotalAttempts(0);
      setScore(0);
      setStreak(0);
      setSessionBestStreak(0);
      setFirstTryCount(0);
      setHintLevel(0);
      setRoundResults([]);
      setSessionMisses([]);
      setZoom(1);
      setScreen('game');
    },
    [selectedMode, selectedContinent, stats.review, worldMap],
  );

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const modes: GameMode[] = ['world', 'continent', 'review'];
    const continents = continentOptions.map((item) => item.code);

    const register = async () => {
      await context.registerTool(
        {
          name: 'start_geography_quiz',
          title: '세계지도 퀴즈 시작',
          description: '선택한 모드로 10문제 세계지도 위치 퀴즈를 시작합니다.',
          inputSchema: {
            type: 'object',
            properties: {
              mode: { type: 'string', enum: modes },
              continent: { type: 'string', enum: continents },
            },
            required: ['mode'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input) {
            const value = input as { mode?: GameMode; continent?: ContinentCode };
            if (!value || !value.mode || !modes.includes(value.mode)) throw new Error('지원하지 않는 게임 모드입니다.');
            if (value.mode === 'continent' && (!value.continent || !continents.includes(value.continent))) {
              throw new Error('대륙 모드에는 올바른 continent 값이 필요합니다.');
            }
            startGame(value.mode, value.continent ?? selectedContinent);
            await waitForPaint();
            return { status: 'started', mode: value.mode, questionCount: QUESTION_COUNT };
          },
        },
        { signal: lifecycle.signal },
      );

      await context.registerTool(
        {
          name: 'get_geography_progress',
          title: '지리 학습 기록 확인',
          description: '이 기기에 저장된 정답 수, 최고 연속 정답, 복습할 나라 수를 확인합니다.',
          inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute() {
            return {
              totalCorrect: stats.totalCorrect,
              bestStreak: stats.bestStreak,
              reviewCountries: Object.values(stats.review).filter((count) => count > 0).length,
            };
          },
        },
        { signal: lifecycle.signal },
      );
    };

    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [selectedContinent, startGame, stats]);

  function handleCountry(code: string) {
    if (!targetCode || feedback === 'correct') return;
    setTotalAttempts((current) => current + 1);
    setLastGuess(code);

    if (code === targetCode) {
      const firstTry = attempts === 0;
      const nextStreak = streak + 1;
      const gained = Math.max(40, 100 - attempts * 25 - hintLevel * 15) + streak * 10;
      setFeedback('correct');
      setScore((current) => current + gained);
      setStreak(nextStreak);
      setSessionBestStreak((current) => Math.max(current, nextStreak));
      setFirstTryCount((current) => current + (firstTry ? 1 : 0));
      setRoundResults((current) => [...current, { code: targetCode, firstTry, missed: attempts > 0 }]);
      playTone(true);
    } else {
      setFeedback('wrong');
      setAttempts((current) => current + 1);
      setStreak(0);
      setSessionMisses((current) => (current.includes(targetCode) ? current : [...current, targetCode]));
      playTone(false);
    }
  }

  function finishSession() {
    const results = roundResults;
    setStats((current) => {
      const review = { ...current.review };
      results.forEach((result) => {
        if (result.missed) review[result.code] = Math.min(9, (review[result.code] ?? 0) + 1);
        else if (result.firstTry && review[result.code]) review[result.code] = Math.max(0, review[result.code] - 1);
      });
      return {
        totalCorrect: current.totalCorrect + results.length,
        totalPlayed: current.totalPlayed + questions.length,
        bestStreak: Math.max(current.bestStreak, sessionBestStreak),
        review,
        lastPlayedAt: new Date().toISOString(),
      };
    });
    setScreen('result');
  }

  function nextQuestion() {
    if (questionIndex >= questions.length - 1) {
      finishSession();
      return;
    }
    setQuestionIndex((current) => current + 1);
    setFeedback('idle');
    setLastGuess(null);
    setAttempts(0);
    setHintLevel(0);
    setZoom(1);
  }

  function goHome() {
    setScreen('home');
    setFeedback('idle');
    setLastGuess(null);
    setZoom(1);
  }

  const modeLabel = selectedMode === 'world'
    ? '세계 도전'
    : selectedMode === 'review'
      ? '오답 복습'
      : `${selectedContinentInfo.name} 집중`;
  const accuracy = totalAttempts ? Math.round((questions.length / totalAttempts) * 100) : 0;

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="relative z-30 border-b border-white/10 bg-[#10243e] text-white">
        <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-4 sm:px-8">
          <button type="button" onClick={goHome} className="flex items-center gap-3 text-left" aria-label="시작 화면으로 이동">
            <span className="grid size-10 place-items-center rounded-[14px] bg-[#ffcf4a] text-[#10243e] shadow-[0_4px_0_#d99e11]">
              <Globe2 className="size-6" strokeWidth={2.4} />
            </span>
            <div>
              <p className="font-heading text-xl font-black tracking-[-0.04em]">어디나라?</p>
              <p className="hidden text-[10px] font-bold tracking-[0.16em] text-[#91b5d4] uppercase sm:block">World map challenge</p>
            </div>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            {screen === 'game' ? (
              <>
                <div className="stat-pill">
                  <Star className="size-4 fill-[#ffcf4a] text-[#ffcf4a]" />
                  <span className="tabular-nums">{score.toLocaleString()}</span>
                </div>
                <div className="stat-pill hidden sm:flex">
                  <Flame className="size-4 fill-[#ff7557] text-[#ff7557]" />
                  <span>{streak} 연속</span>
                </div>
              </>
            ) : (
              <div className="stat-pill hidden sm:flex">
                <Trophy className="size-4 text-[#ffcf4a]" />
                <span>최고 {stats.bestStreak} 연속</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSoundOn((current) => !current)}
              aria-label={soundOn ? '효과음 끄기' : '효과음 켜기'}
              className="grid size-10 place-items-center rounded-xl text-[#bad0e3] transition-colors hover:bg-white/10 hover:text-white"
            >
              {soundOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      {screen === 'home' && (
        <section className="home-stage">
          <div className="home-grid">
            <div className="setup-panel">
              <div className="eyebrow"><Compass className="size-4" /> 오늘의 세계 탐험</div>
              <h1 className="home-title">지도 한 번 눌렀을 뿐인데,<br /><span>나라 위치가 기억나요.</span></h1>
              <p className="home-copy">나라 이름을 보고 지도에서 찾는 10문제 챌린지! 틀린 나라는 다음에 다시 만나 자연스럽게 외워져요.</p>

              <div className="mode-list" aria-label="게임 모드 선택">
                <button
                  type="button"
                  aria-pressed={selectedMode === 'world'}
                  onClick={() => setSelectedMode('world')}
                  className={`mode-card ${selectedMode === 'world' ? 'is-selected' : ''}`}
                >
                  <span className="mode-icon mode-icon-world"><Globe2 /></span>
                  <span className="min-w-0 flex-1">
                    <strong>세계 도전</strong>
                    <small>{allCountryCodes.length}개 나라에서 랜덤 출제</small>
                  </span>
                  <span className="radio-dot"><Check /></span>
                </button>

                <button
                  type="button"
                  aria-pressed={selectedMode === 'continent'}
                  onClick={() => setSelectedMode('continent')}
                  className={`mode-card ${selectedMode === 'continent' ? 'is-selected' : ''}`}
                >
                  <span className="mode-icon mode-icon-continent"><Map /></span>
                  <span className="min-w-0 flex-1">
                    <strong>대륙별 학습</strong>
                    <small>한 지역을 집중해서 차근차근</small>
                  </span>
                  <span className="radio-dot"><Check /></span>
                </button>

                <button
                  type="button"
                  aria-pressed={selectedMode === 'review'}
                  onClick={() => setSelectedMode('review')}
                  className={`mode-card ${selectedMode === 'review' ? 'is-selected' : ''}`}
                >
                  <span className="mode-icon mode-icon-review"><RotateCcw /></span>
                  <span className="min-w-0 flex-1">
                    <strong>오답 복습</strong>
                    <small>{reviewCount ? `${reviewCount}개 나라가 기다리고 있어요` : '틀린 나라가 자동으로 모여요'}</small>
                  </span>
                  <span className="radio-dot"><Check /></span>
                </button>
              </div>

              {selectedMode === 'continent' && (
                <div className="continent-picker">
                  <p>어디부터 탐험할까요?</p>
                  <div>
                    {continentOptions.map((continent) => (
                      <button
                        key={continent.code}
                        type="button"
                        onClick={() => setSelectedContinent(continent.code)}
                        aria-pressed={selectedContinent === continent.code}
                        className={selectedContinent === continent.code ? 'is-active' : ''}
                      >
                        <span style={{ background: continent.color }} />{continent.shortName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button type="button" onClick={() => startGame()} disabled={!worldMap} className="start-button">
                <span>{worldMap ? '탐험 시작하기' : '지도 준비 중…'}</span>
                <ChevronRight className="size-5" />
              </button>

              <div className="home-stats">
                <div><strong>{stats.totalCorrect}</strong><span>지금까지 정답</span></div>
                <div><strong>{stats.bestStreak}</strong><span>최고 연속 정답</span></div>
                <div><strong>{reviewCount}</strong><span>복습할 나라</span></div>
              </div>
            </div>

            <div className="home-map-wrap">
              <div className="map-grid absolute inset-0 opacity-35" />
              <span className="ocean-label left-[5%] top-[29%]">태 평 양</span>
              <span className="ocean-label left-[46%] top-[41%]">대 서 양</span>
              <div className="floating-tip tip-one"><span>🇧🇷</span><b>남아메리카</b></div>
              <div className="floating-tip tip-two"><Sparkles /><b>10문제 챌린지</b></div>
              <div className="home-map-card">
                <div className="map-card-label"><MapPinned className="size-4" /> 지도를 눌러 배우는 세계지리</div>
                <MapBoard map={worldMap} zoom={1} playable={false} />
              </div>
              <div className="teacher-note"><GraduationCap className="size-5" /><span><strong>선생님 추천</strong> 모바일·태블릿·PC에서 바로 시작!</span></div>
            </div>
          </div>
          <footer className="home-footer">
            <span>학습용 국가·지역 표기를 사용합니다.</span>
            <a href="https://github.com/VictorCazanave/svg-maps" target="_blank" rel="noreferrer">Map data © SVG Maps · CC BY 4.0</a>
          </footer>
        </section>
      )}

      {screen === 'game' && targetCode && (
        <section className="game-layout">
          <aside className="question-panel">
            <div className="mx-auto max-w-xl lg:mx-0">
              <div className="flex items-center justify-between">
                <span className="mode-badge">{modeLabel}</span>
                <span className="text-xs font-bold text-muted-foreground">{questionIndex + 1} / {questions.length}</span>
              </div>
              <div className="progress-track"><div style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div>

              <div className="question-copy">
                <p><MapPinned className="size-4" /> 문제 {questionIndex + 1}</p>
                <h1><span>{getCountryName(targetCode)}</span>,<br />지도에서 찾아보세요!</h1>
                <div className="question-meta">
                  <span>{getCountryFlag(targetCode)}</span>
                  <p>{hintLevel >= 1 ? `${targetContinent?.name}에 있어요` : '어느 대륙에 있을까요?'}</p>
                </div>
              </div>

              <output className={`feedback-card is-${feedback}`} aria-live="polite" aria-atomic="true">
                {feedback === 'idle' && (
                  <div className="flex items-center gap-3">
                    <span className="feedback-icon idle"><CircleHelp /></span>
                    <div><strong>첫 번째 클릭은 신중하게!</strong><small>한 번에 맞히면 +100점</small></div>
                  </div>
                )}
                {feedback === 'wrong' && lastGuess && (
                  <div className="animate-shake flex items-center gap-3">
                    <span className="feedback-icon wrong"><X /></span>
                    <div><strong>아깝다! 여기는 {getCountryName(lastGuess)}예요.</strong><small>다시 찾아보세요. 아직 기회가 있어요!</small></div>
                  </div>
                )}
                {feedback === 'correct' && (
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="feedback-icon correct"><Check /></span>
                      <div><strong>정답이에요!</strong><small>수도는 {getCountryCapital(targetCode)}</small></div>
                    </div>
                    <p className="country-fact">{getCountryFact(targetCode)}</p>
                    <button type="button" onClick={nextQuestion} className="next-button">
                      {questionIndex === questions.length - 1 ? '결과 보기' : '다음 나라 찾기'} <ChevronRight />
                    </button>
                  </div>
                )}
              </output>

              {feedback !== 'correct' && (
                <button
                  type="button"
                  onClick={() => setHintLevel((current) => Math.min(2, current + 1))}
                  disabled={hintLevel === 2}
                  className="hint-button"
                >
                  <Lightbulb /> {hintLevel === 0 ? '대륙 힌트 보기' : hintLevel === 1 ? '지도에서 반짝이기' : '힌트를 모두 사용했어요'}
                </button>
              )}

              <div className="session-mini-stats">
                <div><Trophy /><span><b>{firstTryCount}</b> 첫 시도 정답</span></div>
                <div><Zap /><span><b>{sessionBestStreak}</b> 최고 콤보</span></div>
              </div>
            </div>
          </aside>

          <div className="game-map-wrap">
            <div className="map-grid absolute inset-0 opacity-35" />
            <span className="ocean-label left-[7%] top-[26%]">태 평 양</span>
            <span className="ocean-label left-[45%] top-[44%]">대 서 양</span>
            <span className="ocean-label right-[8%] top-[28%]">태 평 양</span>
            <div className="map-toolbar">
              <button type="button" onClick={() => setZoom((current) => Math.min(2.4, current + 0.35))} aria-label="지도 확대"><Plus /></button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((current) => Math.max(1, current - 0.35))} aria-label="지도 축소"><Minus /></button>
            </div>
            <button type="button" onClick={goHome} className="exit-game"><ArrowLeft /> 모드 바꾸기</button>
            <div className="game-map-card">
              <MapBoard
                map={worldMap}
                targetCode={targetCode}
                lastGuess={lastGuess}
                feedback={feedback}
                hintLevel={hintLevel}
                zoom={zoom}
                playable
                onSelect={handleCountry}
              />
              {microCountryCodes.has(targetCode) && feedback !== 'correct' && (
                <div className="micro-tip"><Target /> 아주 작은 나라예요. + 버튼으로 확대해 보세요!</div>
              )}
              <div className="click-note"><span /> 나라를 클릭해 보세요</div>
            </div>
          </div>
        </section>
      )}

      {screen === 'result' && (
        <section className="result-stage">
          <div className="result-map-bg"><MapBoard map={worldMap} zoom={1} playable={false} /></div>
          <div className="confetti confetti-a" /><div className="confetti confetti-b" /><div className="confetti confetti-c" />
          <div className="result-card">
            <div className="result-trophy"><Trophy /></div>
            <p className="result-kicker">10개 나라 탐험 완료!</p>
            <h1>{firstTryCount >= 8 ? '세계지도 에이스!' : firstTryCount >= 5 ? '멋진 탐험이었어요!' : '한 바퀴 더 돌면 완벽해요!'}</h1>
            <p className="result-sub">오늘의 지도 감각이 한 단계 올라갔어요.</p>

            <div className="result-score"><span>최종 점수</span><strong>{score.toLocaleString()}</strong><em>점</em></div>
            <div className="result-stats">
              <div><span className="result-stat-icon green"><Target /></span><strong>{accuracy}%</strong><small>정확도</small></div>
              <div><span className="result-stat-icon yellow"><Star /></span><strong>{firstTryCount}/{questions.length}</strong><small>첫 시도 정답</small></div>
              <div><span className="result-stat-icon coral"><Flame /></span><strong>{sessionBestStreak}</strong><small>최고 콤보</small></div>
            </div>

            {sessionMisses.length > 0 ? (
              <div className="review-preview">
                <div><BookOpenCheck /><p><strong>다음에 다시 만날 나라</strong><small>복습 모드에 자동 저장했어요</small></p></div>
                <div className="review-chips">
                  {sessionMisses.slice(0, 5).map((code) => <span key={code}>{getCountryFlag(code)} {getCountryName(code)}</span>)}
                  {sessionMisses.length > 5 && <span>+{sessionMisses.length - 5}</span>}
                </div>
              </div>
            ) : (
              <div className="perfect-note"><Sparkles /> 틀린 나라 없이 완벽하게 완주했어요!</div>
            )}

            <div className="result-actions">
              <button type="button" onClick={() => startGame(selectedMode, selectedContinent)} className="again-button"><RotateCcw /> 한 판 더</button>
              <button type="button" onClick={goHome} className="home-button">모드 선택으로</button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
