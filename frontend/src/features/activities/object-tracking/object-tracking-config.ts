/**
 * Multiple Object Tracking trial list. It must match the backend (backend/app/services/object_tracking.py);
 * the server holds which circle numbers are targets in each trial and checks the child's picks.
 *
 * Eight circles (numbered 0-7) move around. The targets are marked at the start, then all circles look
 * the same while they keep moving. When they stop, the child picks the circles they were tracking.
 */
export const OBJECT_TRACKING_ACTIVITY_CODE = "multiple-object-tracking";
export const OBJECT_COUNT = 8;

export const CUE_MS = 2500;
export const TRACK_MS = 6000;
export const SELECT_TIME_LIMIT_MS = 15_000;

export const ARENA = { width: 480, height: 320 } as const;
export const RADIUS = 16;
export const SPEED_PX_PER_S = 90;

export interface TrackingTrial {
  id: string;
  targets: number[];
}

function toTrials(raw: number[][], mode: "practice" | "scored"): TrackingTrial[] {
  return raw.map((targets, index) => ({
    id: `${OBJECT_TRACKING_ACTIVITY_CODE}-${mode}-${String(index + 1).padStart(2, "0")}`,
    targets,
  }));
}

export const TRACKING_PRACTICE_TRIALS = toTrials([[0, 1]], "practice");
export const TRACKING_SCORED_TRIALS = toTrials(
  [[0, 2], [3, 5], [1, 4, 7], [0, 6, 2], [1, 3, 5, 6], [0, 2, 4, 7]],
  "scored",
);

export interface MovingObject {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Small deterministic generator so the same trial always starts the same way. */
function seeded(seed: number) {
  let state = seed * 2654435761 + 97;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export function makeObjects(seed: number): MovingObject[] {
  const random = seeded(seed + 1);
  return Array.from({ length: OBJECT_COUNT }, () => {
    const angle = random() * Math.PI * 2;
    return {
      x: RADIUS + random() * (ARENA.width - 2 * RADIUS),
      y: RADIUS + random() * (ARENA.height - 2 * RADIUS),
      vx: Math.cos(angle) * SPEED_PX_PER_S,
      vy: Math.sin(angle) * SPEED_PX_PER_S,
    };
  });
}

/** Moves every circle for `seconds`, bouncing off the walls. */
export function stepObjects(objects: MovingObject[], seconds: number): void {
  for (const object of objects) {
    object.x += object.vx * seconds;
    object.y += object.vy * seconds;
    if (object.x < RADIUS || object.x > ARENA.width - RADIUS) {
      object.vx = -object.vx;
      object.x = Math.min(Math.max(object.x, RADIUS), ARENA.width - RADIUS);
    }
    if (object.y < RADIUS || object.y > ARENA.height - RADIUS) {
      object.vy = -object.vy;
      object.y = Math.min(Math.max(object.y, RADIUS), ARENA.height - RADIUS);
    }
  }
}
