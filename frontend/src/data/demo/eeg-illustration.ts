import type { BandPowerPoint } from "@/types";

export interface IllustrativeEegFixture {
  isIllustrative: true;
  label: string;
  note: string;
  waveformLabel: string;
  bandPower: BandPowerPoint[];
}

export const illustrativeEegFixture: IllustrativeEegFixture = {
  isIllustrative: true,
  label: "Illustrative EEG visualization preview",
  note: "Synthetic waveform and relative band-power values generated for interface demonstration only. Not associated with any participant, recording, preprocessing result, or model output.",
  waveformLabel:
    "Illustrative synthetic waveform for interface demonstration. Not a participant EEG recording.",
  bandPower: [
    { band: "Delta", relativePower: 16 },
    { band: "Theta", relativePower: 22 },
    { band: "Alpha", relativePower: 33 },
    { band: "Beta", relativePower: 29 },
  ],
};
