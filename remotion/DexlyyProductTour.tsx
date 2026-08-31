import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const palette = {
  ink: "#ecfff4",
  muted: "#9bb9aa",
  green: "#46d58b",
  greenDark: "#188357",
  deep: "#061711",
  panel: "#0c251b",
  paper: "#f5faf7",
  darkText: "#10231b",
};

const sans = "Inter, Arial, sans-serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

function clamp(frame: number, input: [number, number], output: [number, number]) {
  return interpolate(frame, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}

function Scene({ children, duration, light = false }: { children: ReactNode; duration: number; light?: boolean }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 14, duration - 16, duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        opacity,
        overflow: "hidden",
        background: light
          ? "radial-gradient(circle at 83% 8%, rgba(70,213,139,.2), transparent 30%), linear-gradient(145deg,#f9fcfa,#eaf4ee)"
          : "radial-gradient(circle at 82% 12%, rgba(70,213,139,.15), transparent 32%), linear-gradient(145deg,#071b13,#04100c)",
        fontFamily: sans,
      }}
    >
      <Grid light={light} />
      {children}
    </AbsoluteFill>
  );
}

function Grid({ light = false }: { light?: boolean }) {
  return (
    <AbsoluteFill
      style={{
        opacity: light ? 0.23 : 0.16,
        backgroundImage: `linear-gradient(${light ? "#73a98d" : "#70d69c"} 1px, transparent 1px), linear-gradient(90deg, ${light ? "#73a98d" : "#70d69c"} 1px, transparent 1px)`,
        backgroundSize: "64px 64px",
        maskImage: "linear-gradient(to bottom, black, transparent 84%)",
      }}
    />
  );
}

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, overflow: "hidden", boxShadow: "0 14px 34px rgba(32,176,109,.22)" }}>
        <Img src={staticFile("dexlyy-logo.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <strong style={{ color: dark ? palette.darkText : "white", fontSize: 27, letterSpacing: "-.05em" }}>Dexlyy</strong>
    </div>
  );
}

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div style={{ color: dark ? palette.greenDark : palette.green, fontFamily: mono, fontSize: 15, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

function BrowserFrame({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <div
      style={{
        overflow: "hidden",
        border: `1px solid ${light ? "rgba(35,103,72,.17)" : "rgba(126,225,171,.18)"}`,
        borderRadius: 28,
        background: light ? "rgba(255,255,255,.92)" : "rgba(9,31,22,.94)",
        boxShadow: light ? "0 42px 100px rgba(30,79,57,.14)" : "0 42px 110px rgba(0,0,0,.42)",
      }}
    >
      <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", borderBottom: `1px solid ${light ? "#dce9e1" : "rgba(145,220,177,.12)"}` }}>
        <div style={{ display: "flex", gap: 7 }}><i style={dot("#ff7d7d")} /><i style={dot("#f4c45d")} /><i style={dot("#58c986")} /></div>
        <span style={{ color: light ? "#70857a" : "#789789", fontSize: 12, fontFamily: mono }}>portal.dexlyy.com</span>
        <div style={{ width: 48 }} />
      </div>
      {children}
    </div>
  );
}

function dot(background: string): CSSProperties {
  return { width: 9, height: 9, borderRadius: 99, background };
}

function OpeningScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 16, stiffness: 90 } });
  const second = spring({ frame: frame - 18, fps, config: { damping: 18, stiffness: 85 } });
  return (
    <Scene duration={125}>
      <div style={{ position: "absolute", top: 52, left: 70 }}><Logo /></div>
      <div style={{ position: "absolute", left: 72, top: 190, width: 820 }}>
        <div style={{ opacity: rise, transform: `translateY(${(1 - rise) * 28}px)` }}><Eyebrow>AI voice interviews for FiveM</Eyebrow></div>
        <h1 style={{ margin: "22px 0 18px", color: "white", fontSize: 78, lineHeight: .98, letterSpacing: "-.07em", opacity: rise, transform: `translateY(${(1 - rise) * 44}px)` }}>
          Meet the right players.<br /><span style={{ color: palette.green }}>Without living in interviews.</span>
        </h1>
        <p style={{ margin: 0, width: 620, color: palette.muted, fontSize: 22, lineHeight: 1.45, opacity: second, transform: `translateY(${(1 - second) * 24}px)` }}>
          One polished flow from Discord verification to the final role assignment.
        </p>
      </div>
      <div style={{ position: "absolute", right: 75, bottom: 60, display: "flex", alignItems: "center", gap: 12, color: "#b6d7c5", fontSize: 14, opacity: clamp(frame, [45, 70], [0, 1]) }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: palette.green, boxShadow: "0 0 18px #46d58b" }} /> Available 24/7
      </div>
    </Scene>
  );
}

function ApplyScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 17, stiffness: 95 } });
  const verify = spring({ frame: frame - 48, fps, config: { damping: 14, stiffness: 100 } });
  return (
    <Scene duration={145} light>
      <div style={{ position: "absolute", top: 50, left: 66 }}><Eyebrow dark>01 / Apply</Eyebrow><h2 style={{ margin: "12px 0 0", color: palette.darkText, fontSize: 48, letterSpacing: "-.06em" }}>A professional first impression.</h2></div>
      <div style={{ position: "absolute", left: 66, right: 66, top: 156, transform: `translateY(${(1 - enter) * 35}px) scale(${.975 + enter * .025})`, opacity: enter }}>
        <BrowserFrame light>
          <div style={{ display: "grid", gridTemplateColumns: "1.15fr .85fr", minHeight: 430 }}>
            <div style={{ padding: "34px 38px", borderRight: "1px solid #dfeae3" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 28 }}><Logo dark /></div>
              <h3 style={{ margin: "0 0 8px", color: palette.darkText, fontSize: 31, letterSpacing: "-.05em" }}>Tell us about yourself.</h3>
              <p style={{ margin: "0 0 25px", color: "#73887d", fontSize: 14 }}>A short application before your private voice interview.</p>
              {["Player name", "Character name", "Your community experience"].map((label, index) => {
                const progress = clamp(frame, [20 + index * 10, 42 + index * 10], [0, 1]);
                return <div key={label} style={{ marginBottom: 13, opacity: progress, transform: `translateX(${(1 - progress) * -18}px)` }}><span style={{ display: "block", marginBottom: 6, color: "#547164", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</span><div style={{ height: index === 2 ? 62 : 42, border: "1px solid #d5e3db", borderRadius: 11, background: "#fbfdfc", padding: "12px 14px", color: "#435d51", fontSize: 12 }}>{index === 0 ? "Jayden Morris" : index === 1 ? "Jay M." : "Five years of serious RP experience…"}</div></div>;
              })}
            </div>
            <div style={{ display: "grid", placeItems: "center", padding: 38, background: "linear-gradient(145deg,#f4faf6,#e9f5ed)" }}>
              <div style={{ width: "100%", padding: 28, border: "1px solid #cfe4d6", borderRadius: 22, background: "white", boxShadow: "0 20px 50px rgba(42,100,73,.1)", opacity: verify, transform: `scale(${.85 + verify * .15})` }}>
                <div style={{ display: "grid", placeItems: "center", width: 58, height: 58, marginBottom: 20, borderRadius: 18, background: "#e4f7eb", color: palette.greenDark, fontSize: 28 }}>✓</div>
                <strong style={{ display: "block", color: palette.darkText, fontSize: 21 }}>Discord verified</strong>
                <span style={{ display: "block", marginTop: 7, color: "#71877c", fontSize: 13 }}>Vellaryn RP membership confirmed</span>
                <div style={{ marginTop: 22, padding: "12px 14px", borderRadius: 11, background: "#237c57", color: "white", textAlign: "center", fontSize: 13, fontWeight: 700 }}>Continue to interview →</div>
              </div>
            </div>
          </div>
        </BrowserFrame>
      </div>
    </Scene>
  );
}

function InterviewScene() {
  const frame = useCurrentFrame();
  const bars = Array.from({ length: 32 }, (_, index) => 12 + Math.abs(Math.sin((frame + index * 4) / 9)) * (22 + (index % 5) * 7));
  const transcriptIn = clamp(frame, [42, 67], [0, 1]);
  return (
    <Scene duration={170}>
      <div style={{ position: "absolute", top: 50, left: 66 }}><Eyebrow>02 / Talk</Eyebrow><h2 style={{ margin: "12px 0 0", color: "white", fontSize: 48, letterSpacing: "-.06em" }}>A natural interview, always ready.</h2></div>
      <div style={{ position: "absolute", left: 66, right: 66, top: 156 }}>
        <BrowserFrame>
          <div style={{ display: "grid", gridTemplateColumns: ".8fr 1.2fr", minHeight: 430 }}>
            <div style={{ display: "grid", alignContent: "center", justifyItems: "center", padding: 34, borderRight: "1px solid rgba(145,220,177,.12)" }}>
              <div style={{ position: "relative", display: "grid", placeItems: "center", width: 138, height: 138, borderRadius: 999, border: "1px solid rgba(85,214,142,.28)", background: "rgba(60,176,111,.09)", boxShadow: `0 0 ${30 + Math.sin(frame / 8) * 12}px rgba(70,213,139,.18)` }}>
                <div style={{ display: "grid", placeItems: "center", width: 92, height: 92, borderRadius: 999, background: "linear-gradient(145deg,#46d58b,#1d8659)", color: "white", fontSize: 35 }}>◉</div>
              </div>
              <strong style={{ marginTop: 24, color: "white", fontSize: 19 }}>Listening to Jayden</strong>
              <span style={{ marginTop: 7, color: palette.muted, fontSize: 12 }}>Question 3 of 8 · 06:42</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4, height: 74, marginTop: 20 }}>{bars.map((height, index) => <i key={index} style={{ display: "block", width: 4, height, borderRadius: 99, background: index % 3 === 0 ? palette.green : "#2f7857" }} />)}</div>
            </div>
            <div style={{ padding: "32px 36px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ color: palette.green, fontFamily: mono, fontSize: 11, letterSpacing: ".1em" }}>LIVE TRANSCRIPT</span><span style={{ color: "#6f9381", fontSize: 11 }}>Private interview room</span></div>
              <div style={{ marginTop: 26, padding: 18, border: "1px solid rgba(96,190,137,.2)", borderRadius: 16, background: "rgba(28,82,58,.27)" }}><span style={{ color: palette.green, fontFamily: mono, fontSize: 10 }}>DEXLYY INTERVIEWER</span><p style={{ margin: "9px 0 0", color: "white", fontSize: 17, lineHeight: 1.5 }}>How would you handle a disagreement with another player during a session?</p></div>
              <div style={{ margin: "14px 0 0 52px", padding: 18, border: "1px solid rgba(163,198,180,.14)", borderRadius: 16, background: "rgba(255,255,255,.055)", opacity: transcriptIn, transform: `translateY(${(1 - transcriptIn) * 18}px)` }}><span style={{ color: "#9bb9aa", fontFamily: mono, fontSize: 10 }}>PLAYER</span><p style={{ margin: "9px 0 0", color: "#dff3e8", fontSize: 16, lineHeight: 1.5 }}>I would de-escalate first, then open a staff ticket if we could not resolve it fairly.</p></div>
              <div style={{ display: "flex", gap: 8, marginTop: 22 }}><span style={chipStyle}>Natural follow-ups</span><span style={chipStyle}>Your questions</span><span style={chipStyle}>20 min max</span></div>
            </div>
          </div>
        </BrowserFrame>
      </div>
    </Scene>
  );
}

const chipStyle: CSSProperties = { padding: "7px 9px", border: "1px solid rgba(118,202,155,.18)", borderRadius: 99, background: "rgba(58,138,94,.12)", color: "#9fd1b6", fontSize: 10 };

function ReviewScene() {
  const frame = useCurrentFrame();
  const approve = spring({ frame: frame - 76, fps: 30, config: { damping: 12, stiffness: 120 } });
  const score = Math.round(clamp(frame, [20, 78], [0, 86]));
  return (
    <Scene duration={155} light>
      <div style={{ position: "absolute", top: 50, left: 66 }}><Eyebrow dark>03 / Review</Eyebrow><h2 style={{ margin: "12px 0 0", color: palette.darkText, fontSize: 48, letterSpacing: "-.06em" }}>Everything your team needs to decide.</h2></div>
      <div style={{ position: "absolute", left: 66, right: 66, top: 156 }}>
        <BrowserFrame light>
          <div style={{ padding: 26, minHeight: 430 }}>
            <div style={{ display: "grid", gridTemplateColumns: ".75fr 1.25fr", gap: 16 }}>
              <div style={lightPanel}><div style={panelTitle}><span>APPLICATION</span><strong>Jayden Morris</strong></div>{["Player name", "Character", "Experience"].map((item, index) => <div key={item} style={{ padding: "12px 13px", marginTop: 9, border: "1px solid #dde9e1", borderRadius: 10, background: "#fbfdfc" }}><span style={{ display: "block", color: "#73887d", fontSize: 9 }}>{item.toUpperCase()}</span><strong style={{ display: "block", marginTop: 5, color: palette.darkText, fontSize: 12 }}>{index === 0 ? "Jayden Morris" : index === 1 ? "Jay M." : "Experienced serious-roleplay player"}</strong></div>)}</div>
              <div style={lightPanel}><div style={panelTitle}><span>AI INTERVIEW SIGNALS</span><strong>Evidence, not an automatic decision</strong></div><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 14 }}>{[["Interview quality", score],["Rules understanding", Math.max(0, score - 5)],["Communication", Math.max(0, score + 3)]].map(([label,value]) => <div key={String(label)} style={{ padding: 14, border: "1px solid #dbe8df", borderRadius: 12, background: "#f8fbf9" }}><span style={{ color: "#70857a", fontSize: 9 }}>{label}</span><strong style={{ display: "block", marginTop: 7, color: palette.darkText, fontSize: 23 }}>{value}<small style={{ color: "#81978b", fontSize: 10 }}>/100</small></strong><i style={{ display: "block", width: `${value}%`, height: 4, marginTop: 9, borderRadius: 99, background: "linear-gradient(90deg,#2b8a61,#65c88f)" }} /></div>)}</div><div style={{ marginTop: 13, padding: 14, border: "1px solid #dce9e1", borderRadius: 12, color: "#587165", fontSize: 12, lineHeight: 1.5 }}>Clear answers, good conflict judgment, and strong evidence of rules awareness.</div></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 15, padding: "13px 15px", border: "1px solid #cee4d6", borderRadius: 13, background: "#edf8f1" }}><span style={{ color: "#46675a", fontSize: 12 }}>Human approval stays final.</span><div style={{ display: "flex", gap: 8 }}><span style={{ padding: "9px 14px", border: "1px solid #efd4d9", borderRadius: 9, color: "#b64a5d", background: "white", fontSize: 11 }}>Decline</span><span style={{ padding: "9px 15px", borderRadius: 9, color: "white", background: "#26815b", fontSize: 11, fontWeight: 700, transform: `scale(${.92 + approve * .08})`, boxShadow: `0 8px ${18 * approve}px rgba(38,129,91,.22)` }}>✓ Approve & assign roles</span></div></div>
          </div>
        </BrowserFrame>
      </div>
    </Scene>
  );
}

const lightPanel: CSSProperties = { minWidth: 0, padding: 17, border: "1px solid #d9e6de", borderRadius: 15, background: "white" };
const panelTitle: CSSProperties = { display: "grid", gap: 4, paddingBottom: 11, borderBottom: "1px solid #e2ebe5", color: "#698076", fontFamily: mono, fontSize: 9 };

function RoleScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 28, fps, config: { damping: 12, stiffness: 115 } });
  const roleTwo = spring({ frame: frame - 48, fps, config: { damping: 13, stiffness: 110 } });
  return (
    <Scene duration={110}>
      <div style={{ position: "absolute", top: 52, left: 70 }}><Logo /></div>
      <div style={{ position: "absolute", left: 90, top: 190, width: 520 }}><Eyebrow>04 / Welcome</Eyebrow><h2 style={{ margin: "15px 0", color: "white", fontSize: 58, lineHeight: 1.02, letterSpacing: "-.065em" }}>One click.<br /><span style={{ color: palette.green }}>The right roles.</span></h2><p style={{ margin: 0, color: palette.muted, fontSize: 19, lineHeight: 1.5 }}>Dexlyy updates Discord the moment your team approves.</p></div>
      <div style={{ position: "absolute", right: 94, top: 150, width: 450, padding: 28, border: "1px solid rgba(109,213,154,.2)", borderRadius: 25, background: "rgba(12,37,27,.9)", boxShadow: "0 38px 100px rgba(0,0,0,.38)", opacity: pop, transform: `translateY(${(1 - pop) * 32}px) scale(${.9 + pop * .1})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}><div style={{ display: "grid", placeItems: "center", width: 58, height: 58, borderRadius: 18, background: "#243b32", color: "white", fontSize: 18, fontWeight: 700 }}>JM</div><div><strong style={{ display: "block", color: "white", fontSize: 20 }}>Jayden Morris</strong><span style={{ display: "block", marginTop: 4, color: palette.muted, fontSize: 12 }}>Vellaryn RP</span></div><div style={{ marginLeft: "auto", display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 99, background: "#def8e8", color: "#1e8558", fontSize: 20 }}>✓</div></div>
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(134,210,168,.13)" }}><span style={{ color: "#789b89", fontSize: 10, fontFamily: mono }}>ROLES ASSIGNED</span><div style={{ display: "flex", gap: 9, marginTop: 12 }}><span style={{ padding: "9px 12px", borderRadius: 9, background: "#247e58", color: "white", fontSize: 12 }}>✓ Developer</span><span style={{ padding: "9px 12px", border: "1px solid rgba(89,205,140,.25)", borderRadius: 9, background: "rgba(55,154,98,.13)", color: "#a9dfc1", fontSize: 12, opacity: roleTwo, transform: `translateX(${(1 - roleTwo) * 14}px)` }}>✓ New Player</span></div></div>
      </div>
    </Scene>
  );
}

function OutroScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 90 } });
  return (
    <Scene duration={100}>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div style={{ opacity: enter, transform: `translateY(${(1 - enter) * 30}px)` }}>
          <div style={{ display: "flex", justifyContent: "center" }}><Logo /></div>
          <h2 style={{ margin: "30px 0 14px", color: "white", fontSize: 66, lineHeight: 1, letterSpacing: "-.07em" }}>Your interviews.<br /><span style={{ color: palette.green }}>Handled.</span></h2>
          <p style={{ margin: "0 auto", color: palette.muted, fontSize: 19 }}>Voice-first whitelist interviews for modern FiveM communities.</p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 11, marginTop: 30, padding: "14px 20px", borderRadius: 12, background: "linear-gradient(135deg,#4ad58f,#31ad73)", color: "#052015", fontSize: 14, fontWeight: 800, boxShadow: "0 18px 40px rgba(70,213,139,.2)" }}>Build your portal <span>→</span></div>
        </div>
      </div>
    </Scene>
  );
}

export function DexlyyProductTour() {
  return (
    <AbsoluteFill style={{ backgroundColor: palette.deep }}>
      <Sequence from={0} durationInFrames={125}><OpeningScene /></Sequence>
      <Sequence from={105} durationInFrames={145}><ApplyScene /></Sequence>
      <Sequence from={225} durationInFrames={170}><InterviewScene /></Sequence>
      <Sequence from={370} durationInFrames={155}><ReviewScene /></Sequence>
      <Sequence from={500} durationInFrames={80}><RoleScene /></Sequence>
      <Sequence from={545} durationInFrames={55}><OutroScene /></Sequence>
    </AbsoluteFill>
  );
}
