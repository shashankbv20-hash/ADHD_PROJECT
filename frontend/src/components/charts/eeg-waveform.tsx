import { cn } from "@/lib/utils";

function buildWaveformPath(): string {
  const points: string[] = [];

  for (let index = 0; index <= 240; index += 1) {
    const t = index / 240;
    const x = t * 600;
    const envelope = Math.sin(t * Math.PI);
    const signal =
      Math.sin(t * Math.PI * 8) * 18 +
      Math.sin(t * Math.PI * 21) * 7 +
      Math.sin(t * Math.PI * 3) * 5;
    const y = 80 - signal * envelope;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return `M ${points.join(" ")}`;
}

const waveformPath = buildWaveformPath();

type EegWaveformProps = {
  className?: string;
  label?: string;
  showCaption?: boolean;
};

export function EegWaveform({
  className,
  label = "Illustrative EEG-style waveform. Synthetic, not real EEG data.",
  showCaption = true,
}: EegWaveformProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/10 bg-[#071824]",
        className,
      )}
    >
      <svg
        viewBox="0 0 600 160"
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        className="h-full w-full"
      >
        <g stroke="rgba(255,255,255,0.07)" strokeWidth="1">
          {[0, 40, 80, 120, 160].map((y) => (
            <line key={y} x1="0" y1={y} x2="600" y2={y} />
          ))}
        </g>
        <g stroke="rgba(255,255,255,0.045)" strokeWidth="1">
          {[100, 200, 300, 400, 500].map((x) => (
            <line key={x} x1={x} y1="0" x2={x} y2="160" />
          ))}
        </g>
        <path
          d={waveformPath}
          fill="none"
          stroke="#3fbdb0"
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      {showCaption ? (
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-3.5 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
            Synthetic signal preview
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/50">
            not EEG
          </span>
        </div>
      ) : null}
    </div>
  );
}
