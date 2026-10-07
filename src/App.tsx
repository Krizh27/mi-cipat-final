import { useState, useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import './App.css';

type SystemState = 'UNINITIALIZED' | 'READY' | 'LOCKED';
type PortVal = number;
type TabType = 'all' | 'workbench' | 'code' | 'monitor' | 'logs';
type ResizeType = 'code-circuit' | 'circuit-monitor' | 'event-terminal';

interface LogEntry {
  time: string;
  msg: string;
  highlight?: boolean;
}

const MIN_CODE_WIDTH = 220;
const MIN_CIRCUIT_WIDTH = 350;
const MIN_MONITOR_WIDTH = 220;
const MIN_TOP_HEIGHT = 350;
const MIN_EVENT_HEIGHT = 120;
const DEFAULT_CODE_WIDTH = 280;
const DEFAULT_MONITOR_WIDTH = 300;
const DEFAULT_TOP_HEIGHT = 520;
const DEFAULT_EVENT_HEIGHT = 190;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const formatBinary = (val: number) => val.toString(2).padStart(8, '0');
const getTimestamp = () => new Date().toLocaleTimeString('en-US', { hour12: false });

export default function App() {
  const [systemState, setSystemState] = useState<SystemState>('UNINITIALIZED');
  const [portA, setPortA] = useState<PortVal>(0);
  const [portB, setPortB] = useState<PortVal>(0);
  const [portC, setPortC] = useState<PortVal>(0);
  const [winner, setWinner] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeInstruction, setActiveInstruction] = useState<string>('');
  const [overlayMsg, setOverlayMsg] = useState<string | null>(null);
  const [animatingWire, setAnimatingWire] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [scale, setScale] = useState<number>(1);
  const [codeWidth, setCodeWidth] = useState<number>(DEFAULT_CODE_WIDTH);
  const [monitorWidth, setMonitorWidth] = useState<number>(DEFAULT_MONITOR_WIDTH);
  const [topHeight, setTopHeight] = useState<number>(DEFAULT_TOP_HEIGHT);
  const [eventHeight, setEventHeight] = useState<number>(DEFAULT_EVENT_HEIGHT);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [resizeType, setResizeType] = useState<ResizeType | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const workbenchContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const resizeStateRef = useRef({
    type: null as ResizeType | null,
    startX: 0,
    startY: 0,
    startCodeWidth: DEFAULT_CODE_WIDTH,
    startMonitorWidth: DEFAULT_MONITOR_WIDTH,
    startTopHeight: DEFAULT_TOP_HEIGHT,
    startEventHeight: DEFAULT_EVENT_HEIGHT,
  });

  const appStyle: CSSProperties = {
    ['--code-width' as any]: `${codeWidth}px`,
    ['--monitor-width' as any]: `${monitorWidth}px`,
    ['--top-height' as any]: `${topHeight}px`,
    ['--event-height' as any]: `${eventHeight}px`,
  };

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    const updateScale = () => {
      if (workbenchContainerRef.current) {
        const containerWidth = workbenchContainerRef.current.clientWidth - 20;
        if (containerWidth > 0) {
          const targetScale = Math.min(1, Math.max(0.4, containerWidth / 600));
          setScale(targetScale);
        }
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    const observer = new ResizeObserver(updateScale);
    if (workbenchContainerRef.current) {
      observer.observe(workbenchContainerRef.current);
    }
    return () => {
      window.removeEventListener('resize', updateScale);
      observer.disconnect();
    };
  }, [activeTab]);

  useEffect(() => {
    if (!isResizing) {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      return;
    }

    document.body.style.userSelect = 'none';
    document.body.style.cursor = resizeType === 'event-terminal' ? 'row-resize' : 'col-resize';

    const handlePointerMove = (event: PointerEvent) => {
      const { type, startX, startY, startCodeWidth, startMonitorWidth, startTopHeight, startEventHeight } = resizeStateRef.current;
      if (!type || !appRef.current) return;

      const rootWidth = appRef.current.clientWidth;
      const rootHeight = appRef.current.clientHeight;
      const headerHeight = headerRef.current?.offsetHeight ?? 72;
      const maxContentHeight = Math.max(0, rootHeight - headerHeight - 12 * 2 - 8);
      const maxEventHeight = Math.max(MIN_EVENT_HEIGHT, maxContentHeight - MIN_TOP_HEIGHT);
      const maxTopHeight = Math.max(MIN_TOP_HEIGHT, maxContentHeight - MIN_EVENT_HEIGHT);

      if (type === 'code-circuit') {
        const nextCodeWidth = clamp(startCodeWidth + (event.clientX - startX), MIN_CODE_WIDTH, rootWidth - MIN_CIRCUIT_WIDTH - MIN_MONITOR_WIDTH - 32);
        setCodeWidth(nextCodeWidth);
      }

      if (type === 'circuit-monitor') {
        const nextMonitorWidth = clamp(startMonitorWidth - (event.clientX - startX), MIN_MONITOR_WIDTH, rootWidth - MIN_CODE_WIDTH - MIN_CIRCUIT_WIDTH - 32);
        setMonitorWidth(nextMonitorWidth);
      }

      if (type === 'event-terminal') {
        const deltaY = event.clientY - startY;
        const nextEventHeight = clamp(startEventHeight - deltaY, MIN_EVENT_HEIGHT, maxEventHeight);
        const nextTopHeight = clamp(startTopHeight + deltaY, MIN_TOP_HEIGHT, maxTopHeight);
        setEventHeight(nextEventHeight);
        setTopHeight(nextTopHeight);
      }
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      setResizeType(null);
      resizeStateRef.current = {
        type: null,
        startX: 0,
        startY: 0,
        startCodeWidth: codeWidth,
        startMonitorWidth: monitorWidth,
        startTopHeight: topHeight,
        startEventHeight: eventHeight,
      };
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [codeWidth, eventHeight, isResizing, monitorWidth, resizeType, topHeight]);

  const handleResizeStart = (type: ResizeType, event: ReactPointerEvent<HTMLDivElement>) => {
    if (window.innerWidth <= 900) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    resizeStateRef.current = {
      type,
      startX: event.clientX,
      startY: event.clientY,
      startCodeWidth: codeWidth,
      startMonitorWidth: monitorWidth,
      startTopHeight: topHeight,
      startEventHeight: eventHeight,
    };

    setResizeType(type);
    setIsResizing(true);
  };

  const resetSplit = (type: ResizeType) => {
    if (type === 'code-circuit') { setCodeWidth(DEFAULT_CODE_WIDTH); }
    if (type === 'circuit-monitor') { setMonitorWidth(DEFAULT_MONITOR_WIDTH); }
    if (type === 'event-terminal') { setTopHeight(DEFAULT_TOP_HEIGHT); setEventHeight(DEFAULT_EVENT_HEIGHT); }
  };

  const addLog = (msg: string, highlight = false) => {
    const time = getTimestamp();
    setLogs(prev => [...prev, { time, msg, highlight }]);
  };

  const showOverlay = (msg: string, duration = 1500) => {
    setOverlayMsg(msg);
    setTimeout(() => setOverlayMsg(null), duration);
  };

  const handleStart = () => {
    setSystemState('READY');
    setPortA(0); setPortB(0); setPortC(0);
    setWinner(null);
    setLogs([]);
    addLog('8085 initialized');
    addLog('8255 initialized');
    addLog('Port A configured INPUT');
    addLog('Port B configured OUTPUT');
    addLog('Port C configured OUTPUT');
    setActiveInstruction('MVI A,90H');
    showOverlay('8255 INITIALIZED');

    setTimeout(() => setActiveInstruction('OUT 83H'), 500);
    setTimeout(() => setActiveInstruction('WAIT: IN 80H'), 1000);
  };

  const handleReset = () => {
    setSystemState('UNINITIALIZED');
    setPortA(0); setPortB(0); setPortC(0);
    setWinner(null);
    setActiveInstruction('');
    setOverlayMsg(null);
    setAnimatingWire(null);
    addLog('System RESET', true);
  };

  const handleButtonPress = (teamIndex: number) => {
    if (systemState !== 'READY') return;

    const teamNum = teamIndex + 1;
    const bitMask = 1 << teamIndex;

    setPortA(bitMask);
    setAnimatingWire(`pa-${teamIndex}`);
    addLog(`PA${teamIndex} = HIGH`);
    showOverlay('8085: IN PORT A', 800);
    setActiveInstruction('WAIT: IN 80H');

    setTimeout(() => {
      setAnimatingWire('bus-8085');
      showOverlay('8085: CHECKING PA0-PA3', 800);
      setActiveInstruction(`ANI ${bitMask.toString(16).padStart(2, '0').toUpperCase()}H`);

      setTimeout(() => {
        showOverlay(`8085: TEAM ${teamNum} DETECTED`, 800);
        addLog(`8085 detected TEAM ${teamNum}`, true);
        setActiveInstruction(`JNZ TEAM${teamNum}`);

        setTimeout(() => {
          showOverlay('8085: OUT PORT B', 800);
          setPortB(bitMask);
          setAnimatingWire(`pb-${teamIndex}`);
          setActiveInstruction(`TEAM${teamNum}: MVI A,${bitMask.toString(16).padStart(2, '0').toUpperCase()}H\nOUT 81H`);

          setTimeout(() => {
            showOverlay('8085: OUT PORT C', 800);
            setPortC(1);
            setAnimatingWire('pc-0');
            addLog(`PB${teamIndex} = HIGH`);
            addLog('PC0 = HIGH');
            addLog('BUZZER ON');
            setActiveInstruction('MVI A,01H\nOUT 82H');

            setTimeout(() => {
              setSystemState('LOCKED');
              setWinner(teamNum);
              showOverlay(`SYSTEM LOCKED - TEAM ${teamNum} WINS`, 2000);
              addLog('SYSTEM LOCKED', true);
              setAnimatingWire(null);
              setActiveInstruction('LOCK: JMP LOCK');
            }, 800);
          }, 800);
        }, 800);
      }, 800);
    }, 800);
  };

  const renderBinary = (val: number) => {
    return formatBinary(val).split('').map((bit, i) => (
      <span key={i} className={bit === '1' ? 'high' : 'low'}>{bit}</span>
    ));
  };

  return (
    <div ref={appRef} className={`app-container ${isResizing ? 'is-resizing' : ''}`} style={appStyle}>
      <header ref={headerRef} className="header">
        <div className="header-title-group">
          <h1>8085 + 8255 QUIZ BUZZER SIMULATOR</h1>
          <span className="header-subtitle">Microprocessor Interfacing Lab</span>
        </div>
        <div className="controls">
          <button
            type="button"
            className="btn btn-start"
            onClick={handleStart}
            disabled={systemState === 'READY' || systemState === 'LOCKED'}
          >
            START SIM
          </button>
          <button
            type="button"
            className="btn btn-reset"
            onClick={handleReset}
          >
            RESET
          </button>
        </div>
      </header>

      <nav className="mobile-nav" aria-label="Simulator panel navigation">
        <button type="button" className={`mobile-tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>🔍 All</button>
        <button type="button" className={`mobile-tab-btn ${activeTab === 'workbench' ? 'active' : ''}`} onClick={() => setActiveTab('workbench')}>⚡ Circuit</button>
        <button type="button" className={`mobile-tab-btn ${activeTab === 'code' ? 'active' : ''}`} onClick={() => setActiveTab('code')}>📜 Code</button>
        <button type="button" className={`mobile-tab-btn ${activeTab === 'monitor' ? 'active' : ''}`} onClick={() => setActiveTab('monitor')}>📊 Ports</button>
        <button type="button" className={`mobile-tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>📟 Terminal</button>
      </nav>

      <div className="workspace-top">
        <div className={`panel code-panel ${activeTab !== 'all' && activeTab !== 'code' ? 'mobile-hidden' : ''}`}>
          <div className="panel-title">
            <span>8085 ASSEMBLY CODE</span>
            {activeInstruction && <span className="title-badge">RUNNING</span>}
          </div>

          <div className="panel-content code-display">
            <div className={`code-line ${activeInstruction === 'MVI A,90H' ? 'active' : ''}`}>MVI A,90H</div>
            <div className={`code-line ${activeInstruction === 'OUT 83H' ? 'active' : ''}`}>OUT 83H</div>
            <div className="code-line label">WAIT: IN 80H</div>
            <div className={`code-line ${activeInstruction === 'ANI 01H' ? 'active' : ''}`}>ANI 01H</div>
            <div className={`code-line ${activeInstruction === 'JNZ TEAM1' ? 'active' : ''}`}>JNZ TEAM1</div>
            <div className={`code-line ${activeInstruction === 'WAIT: IN 80H' ? 'active' : ''}`}>IN 80H</div>
            <div className={`code-line ${activeInstruction === 'ANI 02H' ? 'active' : ''}`}>ANI 02H</div>
            <div className={`code-line ${activeInstruction === 'JNZ TEAM2' ? 'active' : ''}`}>JNZ TEAM2</div>
            <div className={`code-line ${activeInstruction === 'ANI 04H' ? 'active' : ''}`}>IN 80H</div>
            <div className={`code-line ${activeInstruction === 'ANI 04H' ? 'active' : ''}`}>ANI 04H</div>
            <div className={`code-line ${activeInstruction === 'JNZ TEAM3' ? 'active' : ''}`}>JNZ TEAM3</div>
            <div className={`code-line ${activeInstruction === 'ANI 08H' ? 'active' : ''}`}>IN 80H</div>
            <div className={`code-line ${activeInstruction === 'ANI 08H' ? 'active' : ''}`}>ANI 08H</div>
            <div className={`code-line ${activeInstruction === 'JNZ TEAM4' ? 'active' : ''}`}>JNZ TEAM4</div>
            <div className="code-line">JMP WAIT</div>
            <div className="code-line label">TEAM1: MVI A,01H</div>
            <div className={`code-line ${activeInstruction.includes('TEAM1: MVI A,01H') ? 'active' : ''}`}>OUT 81H</div>
            <div className={`code-line ${activeInstruction === 'MVI A,01H\nOUT 82H' && winner === 1 ? 'active' : ''}`}>MVI A,01H</div>
            <div className={`code-line ${activeInstruction === 'MVI A,01H\nOUT 82H' && winner === 1 ? 'active' : ''}`}>OUT 82H</div>
            <div className="code-line">JMP LOCK</div>
            <div className="code-line label">TEAM2: MVI A,02H</div>
            <div className={`code-line ${activeInstruction.includes('TEAM2: MVI A,02H') ? 'active' : ''}`}>OUT 81H</div>
            <div className={`code-line ${activeInstruction === 'MVI A,01H\nOUT 82H' && winner === 2 ? 'active' : ''}`}>MVI A,01H</div>
            <div className={`code-line ${activeInstruction === 'MVI A,01H\nOUT 82H' && winner === 2 ? 'active' : ''}`}>OUT 82H</div>
            <div className="code-line">JMP LOCK</div>
            <div className="code-line label">TEAM3: MVI A,04H</div>
            <div className={`code-line ${activeInstruction.includes('TEAM3: MVI A,04H') ? 'active' : ''}`}>OUT 81H</div>
            <div className={`code-line ${activeInstruction === 'MVI A,01H\nOUT 82H' && winner === 3 ? 'active' : ''}`}>MVI A,01H</div>
            <div className={`code-line ${activeInstruction === 'MVI A,01H\nOUT 82H' && winner === 3 ? 'active' : ''}`}>OUT 82H</div>
            <div className="code-line">JMP LOCK</div>
            <div className="code-line label">TEAM4: MVI A,08H</div>
            <div className={`code-line ${activeInstruction.includes('TEAM4: MVI A,08H') ? 'active' : ''}`}>OUT 81H</div>
            <div className={`code-line ${activeInstruction === 'MVI A,01H\nOUT 82H' && winner === 4 ? 'active' : ''}`}>MVI A,01H</div>
            <div className={`code-line ${activeInstruction === 'MVI A,01H\nOUT 82H' && winner === 4 ? 'active' : ''}`}>OUT 82H</div>
            <div className="code-line">JMP LOCK</div>
            <div className="code-line label">LOCK: JMP LOCK</div>
          </div>
        </div>

        <div
          className={`splitter vertical ${isResizing && resizeType === 'code-circuit' ? 'active' : ''}`}
          onPointerDown={(event) => handleResizeStart('code-circuit', event)}
          onDoubleClick={() => resetSplit('code-circuit')}
          aria-label="Resize code and workbench"
          role="separator"
        />

        <div className={`panel workbench-panel ${activeTab !== 'all' && activeTab !== 'workbench' ? 'mobile-hidden' : ''}`}>
          <div className="panel-title">
            <span>CIRCUIT WORKBENCH</span>
            <span className="title-status-indicator">
              {systemState === 'READY' ? '🟢 READY FOR BUZZER' : systemState === 'LOCKED' ? `🔒 TEAM ${winner} LOCKED` : '⚪ IDLE'}
            </span>
          </div>
          <div className="panel-content workbench-container" ref={workbenchContainerRef}>
            <div
              className="workbench-viewport"
              style={{
                width: `${Math.round(600 * scale)}px`,
                height: `${Math.round(600 * scale)}px`,
              }}
            >
              <div
                className="workbench"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              >
                {overlayMsg && <div className="overlay-status">{overlayMsg}</div>}

                <svg className="wires-svg" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet">
                  <path className={`wire ${animatingWire?.startsWith('pa') ? 'active' : ''}`} d="M 300 120 L 300 200" />
                  <path className={`wire ${animatingWire === 'bus-8085' ? 'active-bus' : ''}`} d="M 300 270 L 300 350" />
                  <path className={`wire ${animatingWire?.startsWith('pb') ? 'active' : ''}`} d="M 220 235 L 150 235 L 150 495 L 230 495" />
                  <path className={`wire ${animatingWire === 'pc-0' ? 'active' : ''}`} d="M 380 235 L 450 235 L 450 495 L 380 495" />
                </svg>

                <div className="team-buttons">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="team-btn-wrapper">
                      <label>TEAM {i + 1}</label>
                      <button
                        type="button"
                        aria-label={`Press Team ${i + 1} Buzzer`}
                        className={`push-btn ${(portA & (1 << i)) ? 'active' : ''}`}
                        onClick={() => handleButtonPress(i)}
                      ></button>
                    </div>
                  ))}
                </div>

                <div className="ic-chip ppi-8255">
                  8255 PPI
                  <div className="chip-notch"></div>
                  <div className="chip-label">PORT A (IN) | B/C (OUT)</div>
                </div>

                <div className="ic-chip cpu-8085">
                  8085 CPU
                  <div className="chip-notch"></div>
                  <div className="chip-label">8-BIT MICROPROCESSOR</div>
                </div>

                <div className="outputs-area">
                  <div className="led-group">
                    <div className="led-row">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className="led-container">
                          <div className={`led ${(portB & (1 << i)) ? 'on' : ''}`}></div>
                          <span className="led-label">T{i + 1} LED</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="buzzer-group">
                    <div className={`buzzer ${portC & 1 ? 'on' : ''}`}>
                      <div className="buzzer-wave"></div>
                      <div className="buzzer-grill"></div>
                    </div>
                    <span className="led-label">BUZZER (PC0)</span>
                  </div>

                  <div className="display-group">
                    <div className="seven-segment">
                      <span className={`seven-segment-text ${winner ? 'active' : ''}`}>
                        {winner ? winner : '8'}
                      </span>
                    </div>
                    <span className="led-label">WINNER</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`splitter vertical ${isResizing && resizeType === 'circuit-monitor' ? 'active' : ''}`}
          onPointerDown={(event) => handleResizeStart('circuit-monitor', event)}
          onDoubleClick={() => resetSplit('circuit-monitor')}
          aria-label="Resize workbench and monitor"
          role="separator"
        />

        <div className={`panel monitor-panel ${activeTab !== 'all' && activeTab !== 'monitor' ? 'mobile-hidden' : ''}`}>
          <div className="panel-title">PORT MONITOR</div>
          <div className="panel-content port-monitor">
            <div className="port-box">
              <div className="port-box-title">PORT A (80H) - INPUT</div>
              <div className="port-binary">{renderBinary(portA)}</div>
            </div>
            <div className="port-box">
              <div className="port-box-title">PORT B (81H) - OUTPUT</div>
              <div className="port-binary">{renderBinary(portB)}</div>
            </div>
            <div className="port-box">
              <div className="port-box-title">PORT C (82H) - OUTPUT</div>
              <div className="port-binary">{renderBinary(portC)}</div>
            </div>
            <div className="port-box port-box-dim">
              <div className="port-box-title">CONTROL (83H)</div>
              <div className="port-binary">{systemState !== 'UNINITIALIZED' ? renderBinary(0x90) : renderBinary(0)}</div>
            </div>

            <div className={`system-status ${systemState === 'READY' ? 'ready' : systemState === 'LOCKED' ? 'locked' : ''}`}>
              <div>STATUS: {systemState}</div>
              {winner && <div className="winner-tag">🏆 WINNER: TEAM {winner}</div>}
            </div>
          </div>
        </div>
      </div>

      <div
        className={`splitter horizontal ${isResizing && resizeType === 'event-terminal' ? 'active' : ''}`}
        onPointerDown={(event) => handleResizeStart('event-terminal', event)}
        onDoubleClick={() => resetSplit('event-terminal')}
        aria-label="Resize event terminal"
        role="separator"
      />

      <div className={`panel event-log ${activeTab !== 'all' && activeTab !== 'logs' ? 'mobile-hidden' : ''}`}>
        <div className="panel-title">
          <span>EVENT TERMINAL</span>
          <span className="log-count">{logs.length} EVENTS</span>
        </div>
        <div className="panel-content log-content">
          {logs.length === 0 ? (
            <div className="log-empty">Press "START SIM" to initialize the 8085 system.</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={`log-entry ${log.highlight ? 'highlight' : ''}`}>
                <span className="time">[{log.time}]</span>
                <span>{log.msg}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
