import type { ResearchOverview } from "@/types";

export const demoResearchOverview: ResearchOverview = {
  meta: {
    isDemo: true,
    label: "Demonstration research workspace",
    note: "Synthetic model entries, dataset metadata, experiment plans, and explainability placeholders for interface review. No model training, inference, experiment execution, dataset files, or validated research results are available.",
    snapshotDate: "2026-10-27",
  },
  models: [
    {
      id: "M-001",
      name: "Baseline CNN",
      architecture: "Convolutional",
      version: "v0.1-demo",
      dataset: "Demo-A (synthetic)",
      accuracy: 0.78,
      precision: null,
      recall: null,
      f1: 0.74,
      auc: 0.81,
      status: "evaluated",
      trainingStatus: "Not run in this frontend",
      evaluationStatus: "Illustrative fixture only",
      limitations: [
        "Accuracy, F1, and AUC are synthetic placeholders.",
        "Precision and recall values are not provided.",
        "No prediction-level outputs, confusion matrix, or ROC data exist.",
      ],
      provenance: "Synthetic research fixture v1.0; no model registry or evaluation run.",
    },
    {
      id: "M-002",
      name: "Temporal LSTM",
      architecture: "Recurrent",
      version: "v0.1-demo",
      dataset: "Demo-A (synthetic)",
      accuracy: 0.81,
      precision: null,
      recall: null,
      f1: 0.78,
      auc: 0.84,
      status: "evaluated",
      trainingStatus: "Not run in this frontend",
      evaluationStatus: "Illustrative fixture only",
      limitations: [
        "Accuracy, F1, and AUC are synthetic placeholders.",
        "Precision and recall values are not provided.",
        "No prediction-level outputs, confusion matrix, or ROC data exist.",
      ],
      provenance: "Synthetic research fixture v1.0; no model registry or evaluation run.",
    },
    {
      id: "M-003",
      name: "Attention Transformer",
      architecture: "Transformer",
      version: "v0.1-demo",
      dataset: "Demo-B (synthetic)",
      accuracy: null,
      precision: null,
      recall: null,
      f1: null,
      auc: null,
      status: "in-review",
      trainingStatus: "Not run in this frontend",
      evaluationStatus: "Awaiting an evaluation record",
      limitations: [
        "No metric values are available.",
        "The architecture label does not imply that a model was trained or evaluated.",
      ],
      provenance: "Synthetic research fixture v1.0; metadata only.",
    },
    {
      id: "M-004",
      name: "Graph connectivity model",
      architecture: "Graph",
      version: "Not assigned",
      dataset: "Not assigned",
      accuracy: null,
      precision: null,
      recall: null,
      f1: null,
      auc: null,
      status: "planned",
      trainingStatus: "Not run in this frontend",
      evaluationStatus: "Not evaluated",
      limitations: [
        "No dataset, configuration, metrics, or evaluation record is assigned.",
        "The model name does not establish expected performance.",
      ],
      provenance: "Synthetic research fixture v1.0; planning metadata only.",
    },
  ],
  datasets: [
    {
      id: "DS-001",
      name: "Demo-A (synthetic)",
      modality: "EEG",
      description:
        "Synthetic dataset label referenced by illustrative model entries.",
      intendedUse:
        "Interface review for model comparison and dataset metadata presentation.",
      availability: "demo-fixture",
      participantCount: null,
      sampleCount: null,
      formats: ["Not documented"],
      source: "Synthetic research fixture",
      provenance:
        "Referenced by model entries M-001 and M-002; no local file or access record.",
      limitations: [
        "No participant count, sample count, or file inventory is documented.",
        "The label is not a verified local dataset.",
      ],
      localFileVerified: false,
    },
    {
      id: "DS-002",
      name: "Demo-B (synthetic)",
      modality: "EEG",
      description:
        "Second synthetic dataset label referenced by a model metadata entry.",
      intendedUse:
        "Interface review for dataset assignment and unavailable metadata states.",
      availability: "demo-fixture",
      participantCount: null,
      sampleCount: null,
      formats: ["Not documented"],
      source: "Synthetic research fixture",
      provenance:
        "Referenced by model entry M-003; no local file or access record.",
      limitations: [
        "No participant count, sample count, or file inventory is documented.",
        "The label is not a verified local dataset.",
      ],
      localFileVerified: false,
    },
    {
      id: "DS-003",
      name: "In-memory CPT activity records",
      modality: "Cognitive task",
      description:
        "Scored CPT runs stored in the current browser session for demonstration purposes.",
      intendedUse:
        "Behavioral summary, progress, and session-comparison interface review.",
      availability: "session-only",
      participantCount: null,
      sampleCount: null,
      formats: ["Trial-event records"],
      source: "ActivitySessionProvider",
      provenance:
        "Current browser session only; records reset on reload and are not written to storage.",
      limitations: [
        "Only the demonstration participant has linked runs.",
        "The records are not a research dataset or clinical measurement.",
      ],
      localFileVerified: false,
    },
    {
      id: "DS-004",
      name: "EEG upload demo metadata",
      modality: "EEG metadata",
      description:
        "File name, extension, size, consent timestamp, and simulated processing stages for demo uploads.",
      intendedUse:
        "Upload-to-review interface review without reading or storing file contents.",
      availability: "demo-metadata",
      participantCount: null,
      sampleCount: null,
      formats: ["Metadata only"],
      source: "DemoSessionProvider",
      provenance:
        "In-memory demo upload metadata; file contents are never read, uploaded, or stored.",
      limitations: [
        "No signal data, participant cohort, or file storage exists.",
        "Metadata resets on reload.",
      ],
      localFileVerified: false,
    },
  ],
  experiments: [
    {
      id: "EXP-007",
      name: "Resting-state baseline",
      researchQuestion:
        "How could resting-state EEG summaries be compared across demonstration sessions without inferring clinical status?",
      methodology:
        "Planned interface walkthrough using synthetic band-power summaries. No signal processing, model execution, or statistical analysis is implemented.",
      status: "planned",
      updatedAt: "2026-10-21T12:00:00Z",
      datasetIds: ["DS-001", "DS-002"],
      modelIds: ["M-001"],
      executionStatus: "not-run",
      resultsAvailable: false,
      limitations: [
        "No experiment has been executed and no results are recorded.",
        "Dataset relationships are synthetic metadata only.",
      ],
      reproducibility: [
        "Synthetic fixture version 1.0.",
        "No random seeds, environment record, or execution log exists.",
      ],
    },
    {
      id: "EXP-008",
      name: "Attention task benchmark",
      researchQuestion:
        "How could CPT measurements be compared across demonstration runs?",
      methodology:
        "Planning and interface review in progress. Uses in-memory CPT records for layout demonstration only; no benchmark execution or scoring pipeline exists.",
      status: "in-progress",
      updatedAt: "2026-10-26T17:40:00Z",
      datasetIds: ["DS-003"],
      modelIds: ["M-002"],
      executionStatus: "not-run",
      resultsAvailable: false,
      limitations: [
        "No benchmark execution or model evaluation exists.",
        "CPT records reset when the browser session ends.",
      ],
      reproducibility: [
        "The participant CPT uses a deterministic trial sequence.",
        "No experiment runner, result store, or environment record exists.",
      ],
    },
    {
      id: "EXP-009",
      name: "Cross-session stability",
      researchQuestion:
        "How could repeated demonstration sessions be described without claiming longitudinal or clinical change?",
      methodology:
        "Planned review of synthetic session metadata and in-memory CPT records. No longitudinal analysis or session linkage is implemented.",
      status: "planned",
      updatedAt: "2026-10-12T09:20:00Z",
      datasetIds: ["DS-001", "DS-003"],
      modelIds: ["M-003"],
      executionStatus: "not-run",
      resultsAvailable: false,
      limitations: [
        "No longitudinal analysis has been run.",
        "Clinician roster session records are not linked to detailed session data.",
      ],
      reproducibility: [
        "Plan only; no execution environment or analysis code is defined.",
      ],
    },
  ],
  featureImportance: [
    { feature: "Theta power", importance: 0.24 },
    { feature: "Alpha peak frequency", importance: 0.2 },
    { feature: "Reaction-time variability", importance: 0.18 },
    { feature: "Beta / theta ratio", importance: 0.15 },
    { feature: "Artifact rate", importance: 0.13 },
    { feature: "Session duration", importance: 0.1 },
  ],
  explainability: {
    status: "illustrative",
    method: "Synthetic feature-importance fixture",
    modelId: "M-002",
    dataset: "Demo-A (synthetic)",
    availableOutputs: ["Feature importance (illustrative only)"],
    unavailableOutputs: [
      "Channel-level attribution",
      "Frequency-band contribution",
      "Temporal or window-level attribution",
    ],
    limitations: [
      "Feature-importance values are synthetic placeholders.",
      "No SHAP, attention extraction, model inference, or attribution computation is implemented.",
      "Attribution values would not establish causality or clinical relevance.",
    ],
    provenance:
      "Synthetic research fixture v1.0; not derived from a trained model or real dataset.",
  },
  provenance: [
    {
      label: "Snapshot",
      value: "27 Oct 2026, 08:00 UTC",
      detail: "Synthetic fixture version 1.0",
    },
    {
      label: "Source",
      value: "Local demo fixtures",
      detail: "No backend, database, model registry, or dataset file store is connected",
    },
    {
      label: "Validation",
      value: "Not validated",
      detail: "Metrics and attributions are illustrative placeholders for interface design",
    },
    {
      label: "Execution",
      value: "Not run",
      detail: "No EEG preprocessing, model training, inference, or experiment execution occurs in this frontend",
    },
    {
      label: "Explainability",
      value: "Illustrative only",
      detail: "Feature-importance values are synthetic and are not computed attributions",
    },
  ],
};
